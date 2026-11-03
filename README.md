# Sprout

A personal plant-care app for two. It tracks every plant you own, works out when each one needs water, food, misting, rotating, cleaning or repotting, and reminds you once a day. You and your partner share one household, so when one of you waters a plant it's checked off on both phones.

Built with [Expo](https://expo.dev) (React Native, TypeScript) so it runs on iPhone, Android and the web. Long term, it will drive automatic watering hardware ([docs/HARDWARE.md](docs/HARDWARE.md)).

## What it does

| Feature | Notes |
| --- | --- |
| **Today list** | Tasks due or overdue, grouped by room. "Water all" for a room, and "Done" or "Later" for each task. |
| **Smart schedules** | Starting intervals come from the species, then adjust for the place's light, indoor or outdoor, pot size and drainage. |
| **Learns from you** | "Soil is still moist" pushes watering back 2 days and lengthens that plant's interval by a day. |
| **Seasons** | Watering stretches about 40% in winter, and fertilizing pauses until spring. Set your hemisphere in Settings. |
| **Places** | Rooms and windows with a light level. Sprout warns when a plant needs more light than its spot gets. |
| **Plant catalog** | 30 common houseplants with care tips, ideal light, difficulty, and pet toxicity from the [ASPCA lists](https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants). You can also add any plant with default care. |
| **Photo ID** | Optional. Snap a photo and identify the plant through the [Pl@ntNet API](https://my.plantnet.org/). |
| **Journal & history** | Photo journal for each plant, plus a log of who did what and when. |
| **Reminders** | One local notification a day at your chosen time, listing which plants need care. |
| **Away mode** | Pauses reminders for 3 days, 1 week or 2 weeks. |
| **Shared household** | Sign in, create a household, and your partner joins with an 8-character invite code. Changes sync live. |

Not built yet: a light meter, photo-based plant diagnosis, and a big species database. See the roadmap below.

## Run it

```bash
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app, or press `w` to open it in a browser.

With no configuration, Sprout runs in **local mode**: everything is saved on that one device. That's fine for trying it out.

## Share it between two phones (Supabase)

Sharing uses a free [Supabase](https://supabase.com) project for the database, sign-in, photo storage and live sync.

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. Open **SQL Editor**, paste the contents of [`supabase/migrations/20261103000000_init.sql`](supabase/migrations/20261103000000_init.sql) and run it. It creates the tables, row-level security (only household members can see a household's data), a private photo bucket, and live-sync settings.
3. Optional: in the Email sign-in settings under **Authentication**, turn off "Confirm email" so you can sign in right away.
4. Copy `.env.example` to `.env.local` and fill in your project URL and anon (public) key from the project's **API** settings.
5. Restart `npx expo start`. Each of you creates an account. One taps **Start a household** and the other taps **Join with a code**, using the code shown in Settings.

The anon key is designed to ship inside apps. Row-level security is what protects your data ([Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security)).

## Photo identification (optional)

Create a free account at [my.plantnet.org](https://my.plantnet.org/), generate an API key, and add it to `.env.local` as `EXPO_PUBLIC_PLANTNET_API_KEY`. An "Identify from a photo" card then appears when adding a plant. The key is bundled into the app, which is acceptable for a two-person app but not for a public one.

## Getting it onto your phones for good

Expo Go needs your computer running `expo start`, so it's for development. To install Sprout as a standalone app:

- **iPhone:** join the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year), then build in the cloud with EAS (`npx eas-cli@latest build --profile preview --platform ios`) and install through ad hoc [internal distribution](https://docs.expo.dev/build/internal-distribution/) or TestFlight. No Mac needed.
- **Android:** `npx eas-cli@latest build --profile preview --platform android` produces an APK you can install directly. No fee.
- **Web:** `npx expo export --platform web`, then host the `dist/` folder (e.g. on Vercel). It's free, but daily reminders only work in the native app.

## Development

```bash
npm test           # unit tests for the scheduling engine (Vitest)
npm run typecheck  # TypeScript
npm run lint       # ESLint (Expo config)
```

The same checks run in GitHub Actions on every push.

```
src/
  app/              screens (Expo Router: every file is a route)
    (tabs)/         Today, Plants, Settings
    plant/[id].tsx  plant detail: schedule, care guide, journal, history
    add-plant.tsx   search / identify → place, pot, last watered
  data/species.ts   bundled care catalog
  lib/schedule.ts   scheduling engine (pure functions, unit tested)
  lib/datasource/   local (AsyncStorage) and Supabase backends behind one interface
  lib/notifications.ts  daily reminder scheduling
  state/            React context for the garden and auth
supabase/migrations/  database schema + security policies
docs/HARDWARE.md      automatic watering plan
```

## Roadmap

1. **Now (v0.1):** everything in the table above.
2. **Next:** a partner nudge (push notification when the other person waters), a light meter, photo diagnosis of sick plants, a bigger catalog, and home-screen widgets.
3. **Automation:** moisture sensors and pumps reporting into the same household, so plants get watered automatically and the app logs it. See [docs/HARDWARE.md](docs/HARDWARE.md). The database tables for this (`devices`, `sensor_readings`, `watering_events`) already exist.

Care intervals in the catalog are starting estimates for typical indoor conditions. Always check the soil before watering.
