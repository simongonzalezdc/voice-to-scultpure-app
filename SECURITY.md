# Security Policy

## Supported Versions

Security fixes target the current `main` branch and latest public release. Older prototypes are not supported unless the same issue affects current code.

## Reporting a Vulnerability

Please do not open a public issue with exploit details, credentials, voice recordings, prompts, API keys, or personal data.

Report security concerns through GitHub Security Advisories or email `security@kyanitelabs.tech` with:

- affected component, browser path, or storage path;
- impact and reproduction steps;
- whether audio, generated sculpture data, prompts, API keys, or private user data was exposed;
- browser, Node, and operating system version.

Expected response: acknowledgement within 3 business days, triage within 7 business days, and a fix or mitigation plan based on severity.

## Project Security Notes

Voice-to-Sculpture Studio runs in the browser and uses microphone input, Web Audio, WebGL/WebGPU, OPFS, and optional user-provided AI keys. Do not commit `.env` files, API keys, recordings, private prompts, generated local storage, or Playwright failure artifacts.

Before a release, run:

```bash
npm audit --audit-level=high
npm run check
npm run lint
npm run test:unit
npm run build
npm run test:integration
gitleaks dir . --no-banner --redact
```
