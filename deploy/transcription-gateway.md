# Route Nova-3 transcription through LiteLLM

Cap keeps Deepgram Nova-3 and the existing caption formatter. The only transport
change sends the SDK request through the shared gateway.

## Runtime configuration

| Setting | Required value |
| --- | --- |
| `AI_GATEWAY_TRANSCRIPTION_URL` | Internal `http://ai-gateway-litellm.ai-gateway.svc.cluster.local:4000/media/cap/nova-3/transcribe` or public `https://ai-gateway.take3tech.dev/media/cap/nova-3/transcribe` |
| `AI_GATEWAY_TRANSCRIPTION_API_KEY` | Dedicated LiteLLM virtual key for Cap transcription |
| `AI_GATEWAY_CF_ACCESS_CLIENT_ID`, `AI_GATEWAY_CF_ACCESS_CLIENT_SECRET` | Both required for the public endpoint; optional as a pair internally |

The key must grant model alias `cap-deepgram-nova-3` and explicitly allow the
passthrough route `/media/cap/nova-3/transcribe`. It is separate from the key
used by Cap chat and summaries. Do not give Cap the provider's Deepgram key.

The Helm chart reads the gateway key from `cap-runtime`, property
`transcription-gateway-api-key`. Set `transcriptionGateway.enabled=true` and
`transcriptionGateway.url` to the internal URL for Kubernetes. Production values
already select these settings. The optional chart-created secret accepts
`runtimeSecret.values.transcriptionGatewayApiKey`.

The gateway reuses `DEEPGRAM_API_KEY` from Secrets Manager secret
`kubernetes/cap/provider-keys/production`. The upstream credential stays in the
gateway. The previous Cap pod injection of `DEEPGRAM_API_KEY` is removed.

## Request and response contract

The gateway must register the custom media route before this Cap image is
deployed. Generic LiteLLM passthrough and the standard transcription adapter do
not preserve the complete existing contract.

- Accept only POST at the fixed route and forward to
  `https://api.deepgram.com/v1/listen`.
- Stream the original audio bytes. Preserve repeated query parameters, including
  the separate `detect_language` values.
- Require `model=nova-3`. Preserve `smart_format=true`, `utterances=true`,
  `mime_type=audio/mpeg`, and the existing explicit-language or auto-detection
  selection.
- Return the raw Deepgram JSON. Keep utterance groups, `punctuated_word`,
  word timestamps, and any speaker fields. Do not translate it to an
  OpenAI transcription response.
- Reject redirects and do not forward caller credentials to Deepgram.
- Authenticate the dedicated key with core LiteLLM auth and enforce its explicit
  passthrough grant. Do not buffer the upload merely to authenticate it.
- Keep audio, transcripts, and request query values out of gateway logs. The
  custom route emits only fixed route/model, status, duration, byte counts, and
  unknown usage/cost.

Cap still uses `@deepgram/sdk` 3.13.0 for the request. Its file request uses
`Content-Type: deepgram/audio+video`. The SDK appends array options as repeated
query fields and returns the raw response. The existing formatter still splits
captions on punctuation, pauses longer than 0.5 seconds, or eight words.
No new speaker, punctuation, language, or transcription model setting is added.

## Capacity and timeout

The existing Cap path loads the complete extracted MP3 into memory before the
SDK call. It has no explicit audio-byte or recording-duration limit and adds no
new one here. Local FFmpeg extraction produces 128 kbps MP3. The workflow queue
library defaults to ten workers unless its environment overrides concurrency.
These are source defaults, not a measurement of the deployed system.

The custom gateway transport allows 3600 seconds for the Cap request and streams
both directions. Capacity planning must include concurrent large uploads; the
gateway must not impose an undocumented small body limit or buffer every upload
in RAM. Existing public Cap ingress permits 10 GiB uploads, but that setting is
not the transcription provider's audio limit.

## Deployment gates

Do not merge or deploy the Cap migration before the following checks pass:

1. Deploy the reviewed gateway callback and provision the dedicated key.
2. Verify unauthorized keys cannot use the route or choose a different model.
3. Use approved synthetic audio to verify the gateway preserves raw bytes,
   repeated language parameters, raw utterances, punctuation, and timestamps.
4. Confirm gateway logs contain no audio or transcript data.
5. Provision `cap-runtime/transcription-gateway-api-key`.
6. Publish a matching Cap image and apply its chart configuration together.
7. Verify the authorized recording, transcription, captions, language selection,
   status, and retry flow after deployment.

If gateway configuration is absent or invalid, Cap treats transcription as
unavailable. It never falls back to a direct Deepgram call. Existing recordings,
captions, storage, Replicate code, Supermemory, chat, and summaries are unchanged.
