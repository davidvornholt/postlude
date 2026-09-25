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

A closing line after the table.`;

export const markdownSemanticsLinks = [
  { href: 'HTTPS://Example.com/Upper', name: 'Secure uppercase' },
  { href: 'hTtP://example.com/Mixed', name: 'Web mixed case' },
] as const;
