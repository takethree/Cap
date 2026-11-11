#!/usr/bin/env python3

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path, PurePosixPath

import yaml
from yaml.nodes import MappingNode, ScalarNode, SequenceNode


ACTION_REFERENCE = re.compile(
    r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*@[0-9a-f]{40}"
)
DOCKER_REFERENCE = re.compile(r"docker://[^\s@]+@sha256:[0-9a-f]{64}")
SELF_ACTION_REFERENCE = re.compile(r"\$/(?:[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*/?)?")
SELF_WORKFLOW_REFERENCE = re.compile(r"\$/\.github/workflows/[^/@\s]+\.ya?ml")
DOCKERFILE_NAME = re.compile(r"Dockerfile(?:\..+)?")
YAML_SUFFIXES = {".yaml", ".yml"}


def is_yaml_path(path):
    return Path(path).suffix.lower() in YAML_SUFFIXES


def is_selected_path(path):
    parsed = PurePosixPath(path)
    parts = parsed.parts
    directories = parts[:-1]
    name = parsed.name.lower()

    if "node_modules" in (part.lower() for part in parts):
        return False

    selected_directory = (
        parts[:2] in ((".github", "workflows"), (".github", "workflow-templates"))
        or any("workflow-templates" in part.lower() for part in directories)
        or any("github-workflow" in part.lower() for part in directories)
    )
    return (selected_directory or name in ("action.yml", "action.yaml")) and is_yaml_path(path)


def repository_files(root):
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=root,
        check=True,
        stdout=subprocess.PIPE,
    )
    return [
        root / os.fsdecode(item)
        for item in result.stdout.split(b"\0")
        if item and is_selected_path(os.fsdecode(item))
    ]


def has_symlink_component(path):
    absolute = Path(os.path.abspath(path))
    current = Path(absolute.anchor)
    for part in absolute.parts[1:]:
        current = current / part
        if current.is_symlink():
            return True
    return False


def mapping_items(node, visited=None):
    if visited is None:
        visited = set()
    if not isinstance(node, MappingNode) or id(node) in visited:
        return
    visited.add(id(node))
    for key, value in node.value:
        if isinstance(key, ScalarNode) and key.tag == "tag:yaml.org,2002:merge":
            # Inspect merges conservatively; hidden references must not bypass the check.
            merged = value.value if isinstance(value, SequenceNode) else [value]
            for mapping in merged:
                yield from mapping_items(mapping, visited)
        else:
            yield key, value


def mapping_values(node, key):
    if not isinstance(node, MappingNode):
        return []
    return [
        value
        for key_node, value in mapping_items(node)
        if isinstance(key_node, ScalarNode) and key_node.value == key
    ]


def error_at(path, node, message):
    return f"{path}:{node.start_mark.line + 1}: {message}"


def validate_action_use(value, path, errors, reusable_workflow=False):
    location = error_at(path, value, "invalid uses entry")
    if not isinstance(value, ScalarNode) or value.tag != "tag:yaml.org,2002:str":
        errors.append(error_at(path, value, "uses must be a scalar string"))
        return

    reference = value.value
    if reference != reference.strip():
        errors.append(f"{location}: uses value has surrounding whitespace")
    elif "${{" in reference or "}}" in reference:
        errors.append(f"{location}: expressions are not allowed in uses")
    elif reference.startswith("./"):
        return
    elif reference.startswith("$/"):
        pattern = SELF_WORKFLOW_REFERENCE if reusable_workflow else SELF_ACTION_REFERENCE
        if pattern.fullmatch(reference) and ".." not in PurePosixPath(reference[2:]).parts:
            return
        errors.append(f"{location}: expected a same-commit $/ path without an @ref suffix")
    elif DOCKER_REFERENCE.fullmatch(reference):
        return
    elif ACTION_REFERENCE.fullmatch(reference):
        return
    else:
        errors.append(
            f"{location}: expected ./local-path, same-commit $/path, "
            "owner/repo[/subpath]@40-lowercase-hex, "
            "or docker://image@sha256:64-lowercase-hex"
        )


def validate_docker_image(image, action_file, root, errors):
    location = error_at(action_file, image, "invalid Docker action runs.image")
    if not isinstance(image, ScalarNode) or image.tag != "tag:yaml.org,2002:str":
        errors.append(
            error_at(action_file, image, "Docker action runs.image must be a scalar string")
        )
        return

    value = image.value
    if "${{" in value or "}}" in value:
        errors.append(f"{location}: expressions are not allowed in Docker action runs.image")
        return
    if value.startswith("docker://"):
        if not DOCKER_REFERENCE.fullmatch(value):
            errors.append(
                f"{location}: Docker images must use docker://image@sha256:64-lowercase-hex"
            )
        return

    if not DOCKERFILE_NAME.fullmatch(Path(value).name):
        errors.append(f"{location}: expected a local Dockerfile or immutable docker:// image")
        return

    dockerfile = action_file.parent / value
    if has_symlink_component(dockerfile):
        errors.append(f"{location}: local Dockerfile paths must not traverse symlinks")
        return

    try:
        dockerfile.resolve(strict=False).relative_to(root.resolve())
    except ValueError:
        errors.append(f"{location}: local Dockerfile must remain inside the repository")
        return

    if not dockerfile.is_file():
        errors.append(f"{location}: local Dockerfile does not exist")


def validate_docker_metadata(document, action_file, root, errors):
    for runs in mapping_values(document, "runs"):
        using = mapping_values(runs, "using")
        if not any(
            isinstance(value, ScalarNode)
            and value.tag == "tag:yaml.org,2002:str"
            and value.value == "docker"
            for value in using
        ):
            continue

        images = mapping_values(runs, "image")
        if not images:
            errors.append(f"{action_file}: Docker action metadata is missing runs.image")
        for image in images:
            validate_docker_image(image, action_file, root, errors)


def inspect_document(document, path, root, errors):
    def inspect_steps(container):
        visited_steps = set()
        visited_sequences = set()

        def inspect_step(step):
            if not isinstance(step, MappingNode) or id(step) in visited_steps:
                return
            visited_steps.add(id(step))
            for value in mapping_values(step, "uses"):
                validate_action_use(value, path, errors)
            for parallel in mapping_values(step, "parallel"):
                if not isinstance(parallel, SequenceNode) or id(parallel) in visited_sequences:
                    continue
                visited_sequences.add(id(parallel))
                for parallel_step in parallel.value:
                    inspect_step(parallel_step)

        for steps in mapping_values(container, "steps"):
            if not isinstance(steps, SequenceNode) or id(steps) in visited_sequences:
                continue
            visited_sequences.add(id(steps))
            for step in steps.value:
                inspect_step(step)

    if Path(path).name.lower() in ("action.yml", "action.yaml"):
        validate_docker_metadata(document, path, root, errors)
        for runs in mapping_values(document, "runs"):
            if any(
                isinstance(using, ScalarNode) and using.value == "composite"
                for using in mapping_values(runs, "using")
            ):
                inspect_steps(runs)
    for jobs in mapping_values(document, "jobs"):
        for _, job in mapping_items(jobs):
            for value in mapping_values(job, "uses"):
                validate_action_use(value, path, errors, reusable_workflow=True)
            inspect_steps(job)


def inspect_file(path, root, errors):
    if has_symlink_component(path):
        errors.append(f"{path}: selected YAML paths must not traverse symlinks")
        return
    if not path.is_file():
        errors.append(f"{path}: selected YAML file does not exist")
        return

    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        errors.append(f"{path}: could not read YAML: {error}")
        return

    try:
        documents = yaml.compose_all(text, Loader=yaml.SafeLoader)
        for document in documents:
            if document is not None:
                inspect_document(document, path, root, errors)
    except yaml.YAMLError as error:
        errors.append(f"{path}: malformed YAML: {error}")


def main():
    parser = argparse.ArgumentParser(
        description="Ensure GitHub Actions and Docker image references are immutable."
    )
    parser.add_argument(
        "paths",
        nargs="*",
        help="specific YAML files to validate instead of discovering tracked files",
    )
    args = parser.parse_args()

    try:
        root = Path(
            subprocess.run(
                ["git", "rev-parse", "--show-toplevel"],
                check=True,
                stdout=subprocess.PIPE,
                text=True,
            ).stdout.strip()
        )
        files = (
            [Path(path) for path in args.paths]
            if args.paths
            else repository_files(root)
        )
    except (OSError, subprocess.CalledProcessError) as error:
        print(f"Could not discover repository YAML files: {error}", file=sys.stderr)
        return 1

    non_yaml_files = [str(path) for path in files if not is_yaml_path(path)]
    if non_yaml_files:
        print(
            f"Only YAML files can be selected: {', '.join(non_yaml_files)}",
            file=sys.stderr,
        )
        return 1

    if not files:
        print("No supported YAML files were selected.", file=sys.stderr)
        return 1

    errors = []
    for path in files:
        inspect_file(path, root, errors)

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print(f"Validated immutable action references in {len(files)} YAML file(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
