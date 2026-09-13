import { ScrollViewStyleReset } from 'expo-router/html'
import type { PropsWithChildren } from 'react'

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#371F80" />
        <meta name="description" content="Mescott — find trusted taskers and get things done." />
        <script src="https://telegram.org/js/telegram-web-app.js?59" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      </head>
      <body>{children}</body>
    </html>
  )
}

const globalStyles = `
html, body, #root { width: 100%; min-height: 100%; margin: 0; }
html { background: #ffffff; overscroll-behavior: none; }
body { overflow: hidden; background: var(--tg-theme-bg-color, #ffffff); }
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
@media (min-width: 720px) {
  #root { max-width: 520px; margin: 0 auto; box-shadow: 0 0 36px rgba(34, 20, 74, 0.12); }
}
`
