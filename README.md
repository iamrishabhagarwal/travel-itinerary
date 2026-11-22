# Andaman Trip Companion

A mobile-first static travel companion for the 25 December 2026 to 2 January 2027 Andaman Islands trip.

## What is included

- Day-wise itinerary
- Flight and hotel summaries
- Confirmed-cost and outstanding-cost dashboard
- Directions tab with route links ordered by itinerary date and time
- Essentials checklist provided in [ESSENTIALS.text](./ESSENTIALS.text), not displayed on the website
- Offline application shell and itinerary data
- No booking documents are included in or accessible from the website
- GitHub Actions deployment for GitHub Pages

## Password-protect the website content

The website is protected by local AES-256-GCM decryption. No password is stored in the repository.

Before deployment:

```sh
node scripts/encrypt-trip.mjs
```

Enter the password privately when prompted. The script encrypts `data/trip.json` as `public/data/trip.enc`. The source file is excluded from Git with `.gitignore`.

Share the password with the other traveler outside GitHub. Open the website, enter it once, and the itinerary will decrypt locally.

This is a practical shared-password gate, not a replacement for server authentication. GitHub Pages remains public and the encrypted ciphertext can be downloaded by anyone.

## Source files and privacy

Original booking files remain in the local `Andaman/` folder. That folder is excluded from Git and is never copied into the website build. The website contains itinerary summaries only; it has no document library or document access features.

The local plaintext itinerary is excluded from Git with `.gitignore`. Only the encrypted `public/data/trip.enc` is used by the deployed password gate.

The itinerary intentionally omits traveler names and unique airline, ferry, hotel, and voucher identifiers.

## Local development

```sh
npm install
npm run dev
```

Build and preview:

```sh
npm run build
npm run preview
```

## Updating trip data

1. Update the source Excel and booking documents. Preserve original files.
2. Ask Copilot to extract and cross-check the changed values.
3. Update `data/trip.json` and route dates/times, then run `node scripts/encrypt-trip.mjs` again.
4. Re-run `npm run build`.
5. Commit source changes and push to `main`.

The UI reads itinerary data only from JSON and local browser storage. Do not add PNRs, booking references, traveler names, email addresses, personal phone numbers, or booking vouchers.
Opening hours and boat schedules in the itinerary are planning guidance, not guarantees. Reconfirm holiday hours, permits, and weather-dependent operations with the relevant authority or operator before travel.

## Deployment

This project is configured for a GitHub repository named `travel-itinerary`.

1. Create a GitHub repository named `travel-itinerary`.
2. Push this project to its `main` branch.
3. In GitHub, open **Settings > Pages** and select **GitHub Actions** as the source.
4. The workflow at `.github/workflows/deploy.yml` builds and deploys automatically.

The deployed URL will normally be `https://<owner>.github.io/travel-itinerary/`.

If the repository name is changed, update `base` in `vite.config.js` to `/<repository-name>/`.

## Offline verification

Open the deployed website once with internet access and leave it open until the service worker finishes installing. Then switch the device to airplane mode and reload. The application shell and encrypted `public/data/trip.enc` should remain available.

Maps and Google Maps links require internet access. No booking documents are cached or available offline through the website.

## Validation report

See `VALIDATION.md` for discrepancies and unresolved items.
