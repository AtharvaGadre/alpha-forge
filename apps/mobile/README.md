# AlphaForge Atmosphere mobile app (legacy)

> **Targets the legacy API.** This Flutter app calls `/api/v1/argon/query`, `/api/v1/news-trade-ideas`,
> `/api/v1/ai-summary` and `/api/v1/trade-ideas`. The first was removed from the Astraeus server; the news and
> summary routes now answer `410 Gone`; `/api/v1/trade-ideas` survives only as an alias of the commodity
> catalogue. The app is kept for reference, is not maintained against the current API (see `API_CONTRACTS.md`),
> and its CI job is disabled.

Architecture notes: `MOBILE_ARCHITECTURE.md`. Build instructions: `ANDROID_BUILD.md`, `IOS_BUILD.md`.

```bash
cd apps/mobile
flutter pub get
flutter analyze
flutter test
```
