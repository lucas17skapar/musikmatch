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

## Supabase chat (logged-in)

Set the env vars in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Enable realtime + RLS for application messages (Supabase SQL editor):

```sql
-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.application_messages;

-- Lock down chat messages to participants only
ALTER TABLE public.application_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_messages_read_participants"
ON public.application_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.applications a
    JOIN public.gigs g ON g.id = a.gig_id
    WHERE a.id = application_messages.application_id
      AND (a.musician_id = auth.uid() OR g.venue_id = auth.uid())
  )
);

CREATE POLICY "app_messages_insert_participants"
ON public.application_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.applications a
    JOIN public.gigs g ON g.id = a.gig_id
    WHERE a.id = application_messages.application_id
      AND (a.musician_id = auth.uid() OR g.venue_id = auth.uid())
  )
);
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
