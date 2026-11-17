# ARC Raiders

An unofficial TRMNL plugin showing active and upcoming ARC Raiders map conditions using the [MetaForge event schedule](https://metaforge.app/arc-raiders). The embedded SVG artwork comes from the [official Map Conditions page](https://arcraiders.com/map-conditions).

Choose a matchmaking region in the plugin settings. All four layouts refresh every 30 minutes and use your TRMNL account's time zone. Scheduled times are shown alongside countdowns calculated at the latest refresh. Countdowns update with the screen.

“Coming up” shows the next occurrence of each condition within 24 hours. Compact layouts show active conditions first. Counts indicate entries that do not fit, and every layout warns when the source data is more than three hours old.

![ARC Raiders map conditions, full layout](TRMNL/media/preview_full.webp)

Sample schedule, not live conditions.

| Half horizontal | Half vertical | Quadrant |
| --- | --- | --- |
| ![Half horizontal layout](TRMNL/media/preview_half_horizontal.webp) | ![Half vertical layout](TRMNL/media/preview_half_vertical.webp) | ![Quadrant layout](TRMNL/media/preview_quadrant.webp) |

## Develop locally

With Node.js 22 and Docker installed, run from the repository root:

```sh
node --test TRMNL/tests/transform.test.cjs
./scripts/preview
```

Browser checks enforce minimum rendered text sizes of 16px on OG and 21 CSS px on X (about 38 panel pixels at its 1.8× render scale). Compact layouts show fewer entries to keep that text legible.

The preview command uses the pinned `trmnl/trmnlp:v0.32.3` image. It runs the real transform against fixed sample data and checks every layout on OG and X, plus a 2-bit OG sample. Cropped screenshots are written to `TRMNL/_build/previews/`; open `TRMNL/_build/report/index.html` for the browser test report.

For live development, install [trmnlp](https://github.com/usetrmnl/trmnlp) v0.32.3 and run `trmnlp serve` from `TRMNL/`. This polls MetaForge and requires network access. Templates, settings, and the transform are in [TRMNL/src](TRMNL/src/).

## Publish

CI runs transform tests, browser layout checks, and template linting. The manually triggered publishing workflow requires those checks to pass before pushing to TRMNL. It uses the `TRMNL_API_KEY` and `TRMNL_PLUGIN_SETTING_ID` repository secrets.

ARC Raiders is a trademark of Embark Studios. This project is unofficial and is not affiliated with Embark Studios or MetaForge.
