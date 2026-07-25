# UI Accessibility Checklist

- [x] Official logo has meaningful alt text unless explicitly decorative.
- [x] Collapsed sidebar retains labelled navigation buttons and icon tooltips through native titles/labels.
- [x] Shared `:focus-visible` ring uses the approved brand focus color.
- [x] Theme controls are native buttons in a labelled group.
- [x] Default reading surfaces use high-contrast navy/slate text.
- [x] Theme access does not imply protected-content access.
- [x] Shared confirmation dialog traps focus, closes with Escape and restores focus to its trigger.
- [x] Mobile drawer traps focus, closes with Escape and restores focus to the header trigger.
- [x] Shared select supports Escape, outside click, arrow navigation and semantic listbox/option roles.
- [ ] Manually verify screen-reader announcements for asynchronous saving/import states.
- [ ] Test all feature-specific tables with a screen reader after the next feature-level UI change.
