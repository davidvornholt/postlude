export const markdownSemanticsFixture = `# Entry heading

## Entry subheading

### Entry detail

#### Entry note

##### Entry aside

###### Entry footnote

[Secure uppercase](HTTPS://Example.com/Upper)

[Web mixed case](hTtP://example.com/Mixed)

| Hour | Mood              |
| :--- | ----------------: |
| Dawn | Calm<br>then busy |
| Dusk | Tired             |

- [x] Watered the plants
- [ ] Call the landlord

A closing line after the table.`;

export const markdownSemanticsChecklist = [
  { checked: true, name: 'Watered the plants' },
  { checked: false, name: 'Call the landlord' },
] as const;

export const markdownSemanticsLinks = [
  { href: 'HTTPS://Example.com/Upper', name: 'Secure uppercase' },
  { href: 'hTtP://example.com/Mixed', name: 'Web mixed case' },
] as const;
