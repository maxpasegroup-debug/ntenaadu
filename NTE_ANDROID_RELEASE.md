# NTE Naadu Android release foundation

## Current source configuration

- Android project: `mobile/android/` (isolated under `nte_naadu`).
- Candidate package ID: `com.ntenaadu.app`; staging installs as `com.ntenaadu.app.staging`.
- App labels: `NTE Naadu` and `NTE Naadu Staging`.
- Version: Flutter `pubspec.yaml` version `0.1.0+1` (version name `0.1.0`, version code `1`).
- Minimum SDK: 23. Compile and target SDK: 36. Google Play's current policy requires new apps and updates submitted from 31 August 2026 to target API 36 or higher. Recheck policy and Flutter/Android tool compatibility before release.
- Permissions: `INTERNET` only. Android cleartext traffic is disabled. No storage, location, contacts, camera, microphone, or notification permission is declared because the currently configured NTE mobile features do not require them.
- Native services: no HappiNotes Firebase plugin/configuration, application IDs, signing files, or provider credentials were copied into this project.

## API origins

The app already takes its API origin from `NTE_API_BASE_URL` at compile time. Keep staging and production origins in the release operator's secret/configuration system or pass them as CI variables; do not commit live environment config. An API origin is not itself a secret, but the production and staging hosts have not yet been provisioned or confirmed. The app rejects missing origins, non-HTTPS release origins, and HappiNotes hosts. A non-release remote origin must identify itself as staging/test/development.

When environments are provisioned, inject the exact origin separately for staging and production builds. Do not put URI credentials, tokens, or keys in `NTE_API_BASE_URL`. No API origin has been invented in this source change.

## Signing and upload-key custody

No keystore was generated and no signing secret was added. `android/key.properties.example` is a non-secret template only. The release build configuration refuses release tasks when the real `android/key.properties` is absent.

Before release, the founder/release owner should:

1. Confirm the final package ID with the organization and Play Console owner. Package IDs are permanent for a published Play app; `com.ntenaadu.app` is only a candidate until approved and checked for availability/ownership.
2. Generate an NTE-only upload key on a controlled release workstation or managed CI secret service; do not generate/store it in this working copy.
3. Store the keystore and passwords in access-controlled secret storage, restrict who can sign, keep an independently protected encrypted backup, and document recovery/rotation ownership.
4. Enroll the app in Play App Signing and register the upload certificate with the NTE Play Console. Never reuse the HappiNotes key. Keep the Play app-signing key under Play's managed signing process where available; the locally held key is only the upload key.
5. Place `key.properties` and the NTE upload keystore only in the controlled signing environment. They are excluded by repository ignore rules.

## Review gate / unresolved choices

- Founder approval is required for `com.ntenaadu.app` (and the staging suffix convention) before any build or Play registration.
- Confirm production API host and staging API host after Phase 2 operator provisioning.
- Confirm release owner, Play Console ownership, key generation and backup custody, and whether a production signing pipeline will use a managed secret store.
- The source scaffold has not been built or verified. Review the application ID, Gradle/plugin versions, SDK targets, permissions, launcher mark, and signing logic before authorizing any build.
