`<name>.config.json`'s `contentType` is the switch.

**document → paper** is a one-line change. You are adding toolchains, not
removing content.

**paper → document** additionally means removing every math block and every
`lean` field. Run `content_profile_check` after flipping the switch and it
lists exactly what is in the way.

---
