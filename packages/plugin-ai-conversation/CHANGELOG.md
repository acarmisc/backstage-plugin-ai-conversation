# Changelog

## 0.20.1 — 2026-10-05

### Fixed

- Attaching images with the paperclip did nothing: the picked files were
  discarded before they were read.
- Pasting and dropping images on the composer now attach them, as the user
  guide already described.
- A message can be only images: Send is enabled once an image is staged, and
  the conversation is titled after the first image.
- Regenerate and edit-and-resend keep the message's images.
- Images are no longer written to browser storage or to the server-side
  thread. A few images exceeded the browser's storage quota, which silently
  stopped every conversation from being saved, and the server's 1MB
  per-thread cap. After a reload, earlier images show as file names and are
  not sent again.

### Changed

- Staged images show a thumbnail inside the composer. Files that aren't PNG,
  JPEG, WebP or GIF, or are larger than 4 MB, are refused with a message
  instead of failing when sent.

## 0.20.0 — 2026-10-05

### Changed

- The chat page now looks like the rest of Backstage: it is built from
  standard MUI components and `@backstage/core-components` on your Backstage
  theme, without custom gradients, pill buttons, rounded cards or shadows.
  Code blocks use Backstage's `CodeSnippet`, Markdown tables and usage figures
  use standard tables, and loading answers show skeleton lines.
- The page no longer loads the JetBrains Mono webfont from Google Fonts; only
  the KaTeX stylesheet (`cdn.jsdelivr.net`) is still needed in your Content
  Security Policy.
- New dependency: `@backstage/core-components`.
- Tone, focus and verbosity start unset ("Default") in every conversation, and
  **Reset to defaults** clears them. Before, only the first page load
  preselected Friendly / Explain reasoning / Concise, while new and reopened
  conversations started unset.
- The Tune button shows a dot when any conversation setting is set.

## 0.19.0 — 2026-10-05

### Changed

- Redesigned chat page:
  - sidebar with conversations grouped by date (Pinned, Today, Yesterday,
    Previous 7 and 30 days, Older), search, inline rename, pin, export and
    delete with confirmation; import and storage information in its footer;
  - welcome screen with the active team and model, skill cards and starter
    prompts, and a team picker when a team is required;
  - quick Team, Model, Knowledge and Skill pickers in the composer; tone,
    focus, verbosity, reasoning effort, web search and extra instructions
    moved to a **Tune** drawer;
  - answers without bubbles, styled Markdown and code blocks, typing
    indicator, per-answer token count and sources chip;
  - Sources and Usage tabs in the right panel, with the key's budget and
    expiry;
  - errors explained in plain words; light and dark theme.
- The page fits under the app header instead of overflowing it.

### Added

- Compare mode can be turned on from the header (it had no entry point) and
  its models changed while it is on.
- Rename conversations; export and copy them as Markdown.
- Paste or drop images into the composer.
- Keyboard shortcuts: new chat, search, toggle sidebar, stop, focus the
  message box.
- Default export for feature discovery in the new frontend system.

### Fixed

- A message sent while the conversation had no key yet could be dropped.
- The sources chip and token counts never showed for answers from the
  backend.
- Stored conversations now show the sources of their last answer.
- The streaming view no longer jumps to the bottom while you read earlier
  messages.
- Failures loading the chat configuration or teams are shown instead of
  ignored.

## Earlier versions

See the [commit history](https://github.com/acarmisc/backstage-plugin-ai-conversation/commits/main).
