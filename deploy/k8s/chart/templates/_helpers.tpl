{{- define "cap.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "cap.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "cap.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ include "cap.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "cap.selectorLabels" -}}
app.kubernetes.io/name: {{ include "cap.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "cap.configName" -}}
{{- include "cap.fullname" . }}-config
{{- end -}}

{{- define "cap.secretName" -}}
{{- default (printf "%s-runtime" (include "cap.fullname" .)) .Values.runtimeSecret.name -}}
{{- end -}}

{{- define "cap.serviceAccountName" -}}
{{- default (include "cap.fullname" .) .Values.serviceAccount.name -}}
{{- end -}}

{{- define "cap.webName" -}}
{{- include "cap.fullname" . }}-web
{{- end -}}

{{- define "cap.mediaServerName" -}}
{{- include "cap.fullname" . }}-media-server
{{- end -}}

{{- define "cap.mysqlName" -}}
{{- include "cap.fullname" . }}-mysql
{{- end -}}

{{- define "cap.minioName" -}}
{{- include "cap.fullname" . }}-minio
{{- end -}}
