This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Scheduled dependency audit alerts

The existing `warmap-pipeline.timer` runs the dependency audit every two hours. High/critical findings trigger a non-forced `npm audit fix`; dependency changes are retained for the pipeline commit only when the post-fix audit, lint, and build pass. Otherwise, dependency files are restored. A Telegram message is sent only for high/critical findings or audit/fix/validation failures.

Configure the existing OpenClaw Telegram bot on the host in `/etc/warmap-pipeline.env` (keep this file outside Git and restrict it to the service administrator):

```ini
TELEGRAM_BOT_TOKEN=replace-with-existing-openclaw-bot-token
TELEGRAM_CHAT_ID=replace-with-alert-group-chat-id
```

Run `sudo cp warmap-pipeline.service /etc/systemd/system/warmap-pipeline.service`, save the environment file with permissions `600`, then run `sudo systemctl daemon-reload`. Use `sudo systemctl start warmap-pipeline.service` to start the next pipeline cycle immediately. Alert delivery errors, including missing Telegram configuration, are logged to the systemd journal.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
