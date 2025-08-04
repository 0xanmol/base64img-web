# base64img-web

I needed a simple tool to convert images to base64 data URIs for a project I was working on. Figured I'd throw it together and open source it since someone else might find it useful too.

## What it does

Converts images to base64 PNG data URIs. You can drag/drop images, optionally fit them to a square canvas, and copy the result. That's about it.

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Building

```bash
npm run build
```

Built with React + TypeScript + Vite. Works client-side only, no backend needed.
