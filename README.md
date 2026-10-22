# Browser Mirror for Bot-Hosting.net

## Important hosting requirement
This project runs headless Chromium via Puppeteer. It needs a Linux container with compatible browser libraries and enough RAM. The provider's smallest free plan (256 MB RAM) is likely insufficient. Use a deployment with at least 512 MB RAM (1 GB is safer) and enough storage, if available.

## Files
- `server.js`
- `package.json`
- `public/index.html`

## Deploy
1. Create a Node.js application deployment in Bot-Hosting.net.
2. Upload this ZIP and extract it so `package.json`, `server.js`, and `public/` are in the deployment root.
3. Set startup/entry file to `server.js`.
4. Set startup command to `npm install && npm start` if the panel requires a custom command.
5. Add environment variable `MIRROR_TOKEN` with a long random secret (e.g. 64 hex characters generated with `openssl rand -hex 32` locally). Mark it secret/private.
6. Ensure the app's public HTTP port uses `SERVER_PORT` or `PORT`; the server binds to `0.0.0.0`.
7. Start the deployment and check logs. Puppeteer downloads Chrome during package installation, but some hosting containers may lack required Linux shared libraries. If logs report missing libraries or the browser cannot launch, this host/runtime may not support bundled Chromium without a custom image.
8. Open the assigned HTTPS app URL. Enter the exact `MIRROR_TOKEN` value when prompted.
9. To change the token in your browser, open the URL with `?reset=1`.

## Security
- Never publish your token or put it in a public repository.
- Do not expose a browser debugging port.
- The screenshot view refreshes every 5 seconds; it is not a video stream.
- Avoid signing into sensitive accounts on a public/shared deployment. Anyone who obtains the token can control the browser session.
- The browser is public-facing; use it only for sites you are authorized to access.
