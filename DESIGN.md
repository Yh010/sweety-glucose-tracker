---
name: Sweety
description: A calm daylight journal for daily glucose readings.
colors:
  forest: "#164f46"
  forest-hover: "#23685b"
  ink: "#213c34"
  muted: "#63736b"
  form-muted: "#53644f"
  work-surface: "#f6f8f5"
  white: "#ffffff"
  line: "#dce5dd"
  mint: "#e9f0e5"
  reading-form: "#eaf0e5"
  lime: "#dcedc7"
  danger: "#a12d29"
  focus: "#438778"
  input-border: "#c4d1c7"
  badge: "#edf3e8"
  nav-text: "#c3d8cb"
  nav-hover: "#2e6456"
  segmented: "#e8eee5"
typography:
  display:
    fontFamily: "Manrope Variable, Segoe UI, sans-serif"
    fontSize: "clamp(32px, 3.3vw, 50px)"
    fontWeight: 550
    lineHeight: 1.2
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Manrope Variable, Segoe UI, sans-serif"
    fontSize: "clamp(26px, 2.2vw, 34px)"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Manrope Variable, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Manrope Variable, Segoe UI, sans-serif"
    fontSize: "13px"
    lineHeight: 1.9
  label:
    fontFamily: "Manrope Variable, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 650
  input:
    fontFamily: "Manrope Variable, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 500
rounded:
  badge: "5px"
  icon: "6px"
  field: "7px"
  control: "8px"
  panel: "12px"
spacing:
  compact: "12px"
  control: "16px"
  mobile-gutter: "20px"
  panel: "24px"
  desktop-gap: "28px"
  desktop-gutter: "44px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "12px 19px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.forest-hover}"
  button-text:
    textColor: "{colors.forest}"
    padding: "4px 0"
  button-export:
    backgroundColor: "{colors.white}"
    textColor: "{colors.forest}"
    rounded: "{rounded.control}"
    padding: "12px 19px"
  button-today:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.forest}"
    rounded: "{rounded.badge}"
    padding: "6px 10px"
    typography: "{typography.label}"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "11px 12px"
    typography: "{typography.input}"
  navigation-active:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.forest}"
    rounded: "{rounded.control}"
    padding: "14px 16px"
  badge:
    backgroundColor: "{colors.badge}"
    textColor: "{colors.forest}"
    rounded: "{rounded.badge}"
    padding: "6px 10px"
  log-panel:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.panel}"
  reading-form:
    backgroundColor: "{colors.reading-form}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "25px 24px 22px"
---

# Design System: Sweety

## Overview

**Creative North Star: "Daylight journal"**

Sweety uses an offwhite work surface, forest-green navigation and a pale-green reading form. Quiet borders and open spacing make four daily meal slots and their values easy to scan. This records the implemented system, derived from the React components and stylesheet.

The interface feels personal and calm. Small Lucide line icons support labels; tabular numbers keep readings aligned. Copy describes a private record without interpreting readings as clinical categories.

**Key Characteristics:**

- Forest-green rail that becomes top navigation on mobile.
- White journal rows beside a pale-green entry form.
- Self-hosted Manrope and readable tabular values.
- Restrained motion, visible keyboard focus and explicit states.

## Colors

The palette combines forest green with warm, lightly green neutrals. Frontmatter values are normative; names below describe their application.

### Primary

- **Forest:** navigation shell, primary buttons, text actions and chart line.
- **Forest hover:** primary button hover on a fine pointer.
- **Lime:** active desktop navigation, active mobile underline and brand details.

### Neutral

- **Work surface:** the application background.
- **White:** log, report panels and input surfaces.
- **Ink:** main labels, headings and reading values.
- **Muted:** supporting text on white and offwhite surfaces.
- **Form muted:** supporting text inside the pale-green reading form; preserve this darker local override.
- **Line / input border:** panel separation and field boundaries respectively.
- **Reading form / mint / badge:** quiet supporting surfaces; use the reading-form tone for the actual entry panel.
- **Nav text:** secondary navigation and account text on forest.

Danger red identifies errors and destructive actions. Focus green identifies keyboard focus. Meal-slot icons use four soft contextual color pairs: gold fasting, warm brown breakfast, leafy lunch and slate-blue dinner. These distinguish slots, not glucose categories.

**The Contextual Contrast Rule.** Use the form-specific muted color inside the reading panel rather than inheriting the lighter global muted color.

## Typography

Manrope Variable is self-hosted through `@fontsource-variable/manrope`, with Segoe UI and sans-serif fallbacks. The same family carries display, labels and data. The compact interface uses mostly sentence case and modest negative heading tracking.

- **Display:** the authentication story heading uses the display role.
- **Headline:** application page titles use the headline role; mobile fixes them at 26px. Authentication form titles are 29px, or 28px on mobile.
- **Title:** panel titles use the title role; compact mobile log titles become 17px and report-detail titles 16px.
- **Body:** normal supporting paragraphs are generally 12–14px with generous line height; the body token represents the authentication copy and empty-state prose, not a global browser body size.
- **Label:** fields and compact helper copy use 12px; buttons use 13px, weight 650.
- **Inputs:** 16px values remain readable on phones.
- **Data:** log values are 23px, weight 600, with tabular numerals; summary values are 27px, weight 550. Responsive variants reduce these to 21–24px and 23px respectively.

**The Stable Numbers Rule.** Keep tabular numerals for glucose values and summaries; retain visible units in the surrounding reading context.

## Layout

The desktop shell is a 224px sticky full-height rail plus a flexible workspace. The topbar is 76px high. Main content is centered at a maximum width of 1400px, with 42px top and 44px side padding. Daily content uses a flexible log column plus a 292px form, separated by 28px. Log and summary form the left column; the entry form stays separate on the right.

- At 1500px and wider, main top padding becomes 50px, the form 320px and the daily gap 36px; log rows grow from 94px to 102px.
- At 1200px and narrower, the rail becomes 192px, workspace gutters 28px and form 260px with a 20px gap. Page headings stack. Per-row units are hidden, so retain the shared “Values in mg/dl” log label.
- Between 761px and 960px, the rail is 158px. Daily content becomes one column and the form fields use a two-column grid. The decorative journal note and form note are hidden.
- At 760px and narrower, navigation becomes a forest-green top region. Content has 20px gutters; the topbar is 42px high. The daily log, summary and full-width form stack in that order with a 30px layout gap. Four summary columns remain, with units below numbers. Report period controls fill the width; the report range stacks.

Report controls wrap with a 16px gap: period selection and CSV download share a desktop row, while download sits below the full-width period selector on mobile. The Today shortcut stays inside the date control on both sizes.

The body supports a minimum width of 320px. Report tables scroll horizontally when needed. Authentication uses two equal desktop columns, with a 360px-wide form; mobile removes the story panel and shows a brand above the form.

## Elevation & Depth

Tonal layering and fine borders do most of the work. Log and report panels remain flat. Only logout confirmation uses a floating shadow (`0 8px 24px #0b2b2629`); the active report segment has a small shadow (`0 2px 5px #183b2612`).

**The Quiet Surfaces Rule.** Keep journal panels flat; reserve elevation for the existing confirmation layer and selected segment.

## Shapes

Panels have gently rounded 12px corners; buttons and date-picker containers use 8px, fields 7px, icon actions 6px and count badges 5px. Meal icons use softly squared 12px containers, reduced to 10px on mobile. Avatars and small status dots are circular. Borders are thin and low contrast; use stronger field boundaries where entry is expected.

## Components

### Buttons

Primary actions use forest fill, white text, 46px minimum height and compact horizontal padding. A fine-pointer hover lightens the fill; press scales to 0.98. Text actions use forest with a hover underline. Icon actions have transparent backgrounds and a soft-green hover fill; destructive icon hover uses a pale-red surface and danger text. Disabled buttons use 0.48 opacity and a not-allowed cursor.

CSV download uses the same button shape and press behavior, with white fill, forest text, a fine line border and a 16px download icon. Its minimum height becomes 42px on mobile. Today is a compact mint-filled button inside the date control, with a 5px radius and 12px semibold label; its horizontal padding reduces to 7px on mobile. Both retain the shared keyboard focus and disabled treatment.

All keyboard focus uses a 3px green outline with 4px offset. Background transitions take 150ms; button press transforms take 140ms with the project ease-out curve. Reduced motion collapses transitions and animations to 0.01ms.

### Inputs / Fields

White fields have a visible border, 46px minimum height and green focus border. Labels remain above fields. Invalid glucose inputs receive a danger border with an associated alert message; helper and error text remain in the form flow. Pending save disables the fieldset and changes the button to “Saving…”. The glucose unit sits inside the field without replacing its label or helper text.

### Navigation

Desktop active navigation uses lime fill on the forest rail. Inactive items are muted pale green and receive a darker-green hover surface. Mobile active navigation becomes lime text and a 2px underline. Keep icon and visible text together; icon-only account actions have accessible names. A focus-revealed skip link targets main content.

### Journal log and reading form

Keep all four named slots visible: fasting, after breakfast, after lunch and after dinner. Empty slots expose “Record”; recorded slots show a value, “Recorded” with a check, and edit/delete actions. A count badge shows progress without hiding empty slots. “Record” selects that slot and focuses the glucose input in the same form; edit also uses that form. Deletion asks for confirmation inline. The shared “Values in mg/dl” label stays visible when compact rows omit repeated units.

The form suggests the first empty slot in meal order and advances after a save. Refreshed suggestions must preserve a typed value and a manually chosen slot. Once all four slots on the selected day are filled, retain the form and show a forest-colored check with an inline status note: “All four readings are recorded. Edit an entry in your log or choose another date below.” The note uses 12px type, 1.8 line height and a 22px top margin. Disable the slot, glucose field and “Day complete” submit button while keeping the date available; editing an existing entry remains possible.

### Date control

Keep native date entry between previous/next arrows. Show Today only when viewing a past date; it returns to the application's current date. The next arrow remains disabled at today. During CSV preparation, disable the report date control together with period selection so the visible range remains tied to the download.

### Reports

Report periods use three segmented buttons with `aria-pressed`; selection uses a white inset surface and small shadow. The range label and chart share the exact report start and end. Chart points represent daily averages, with no point for missing days; the caption explains that lines connect recorded days. Use forest strokes, small white-edged points, dashed neutral gridlines and a textual SVG description. Daily reports use a table. Empty reports present a journal icon, plain explanation and action back to the daily log.

“Download CSV” exports the selected report. Disable it while report data is fetching, when the range has no readings, and during export. Preparation changes the label to the literal “Preparing CSV...” while the existing report stays visible. Export errors reuse the inline error block with Retry; changing date or period clears the export error. Keep the download in the same control family rather than adding another accent color.

### Feedback

Successful saves and deletes announce compact inline messages through a polite live region. Loading uses a spinner and text; errors use a pale-red block with danger text and retry when available. Do not replace the four visible journal slots with a generic empty card.

## Do's and Don'ts

### Do:

- **Do** use the darker form helper color on the pale-green reading panel.
- **Do** preserve four named slots, visible units and tabular glucose values.
- **Do** reuse the same entry form for Record and Edit, including focus transfer.
- **Do** keep chart bounds tied to the report's exact date window.
- **Do** preserve typed drafts when suggesting the next empty slot.
- **Do** keep date entry available when a day is complete, and freeze report range controls only while preparing its CSV.
- **Do** preserve keyboard focus, text labels and reduced-motion behavior.

### Don't:

- **Don't** use meal-slot colors as clinical glucose categories.
- **Don't** introduce decorative shadows on flat journal panels.
- **Don't** remove the shared unit label when hiding per-row units.
- **Don't** replace the mobile top navigation with the desktop rail.
