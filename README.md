# ARC Raiders

Map conditions for your next trip topside. Active and upcoming ARC Raiders events on TRMNL, with official event symbols and local start and end times.

<a href="TRMNL/README.md#setup"><img width="150" alt="Works with TRMNL" src="https://trmnl.com/images/brand/badges/light/works-with-trmnl/trmnl-badge-works-with-light.svg" /></a>

[Set up on TRMNL](TRMNL/README.md#setup)

![Active and upcoming ARC Raiders map conditions on TRMNL](TRMNL/media/preview_full.webp)

[All layout previews](TRMNL/README.md#previews).

## Settings

- No external account needed. Choose your matchmaking region; times follow your TRMNL account time zone.
- Use Polling, Framework 3.4.6, Node Serverless and a 15-minute refresh interval.

Full, half horizontal, half vertical and quadrant layouts support TRMNL OG and TRMNL X. “Coming up” shows the next occurrence of each condition within 24 hours; compact layouts show active conditions first. Countdowns update with the screen.

## Develop locally

Install [trmnlp](https://github.com/usetrmnl/trmnlp) v0.32.3, then run from the repository root:

```sh
cd TRMNL
trmnlp serve
```

The local preview polls MetaForge using the region and time zone in [TRMNL/.trmnlp.yml](TRMNL/.trmnlp.yml). Templates, settings and the transform live in [TRMNL/src/](TRMNL/src/); the [plugin guide](TRMNL/README.md#setup) covers setup and checks.

Schedule data comes from [MetaForge](https://metaforge.app/arc-raiders). The logo and event symbols come from the [official Map Conditions page](https://arcraiders.com/map-conditions).

## Trademark and artwork notice

ARC Raiders is a trademark of Embark Studios. This project is unofficial and is not affiliated with Embark Studios or MetaForge.

[Questions or ideas?](https://github.com/taichikuji/trmnl-arc-raiders-plugin/issues)
