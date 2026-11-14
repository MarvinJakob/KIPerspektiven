> **Placeholder.** The privacy policy has not been written yet (Design.md, section 12). The information below describes the technical setup and still needs a legal review.

## In short

- We do not use tracking cookies or analytics tools. There are no optional cookies or similar technologies.
- Our server counts how often public pages are requested, as a daily total and additionally deduplicated per IP address using a protected derivation (see "Statistics").
- We only store the result of the AI readiness self-assessment if you agree beforehand, and then anonymously.
- If you request a free consultation on the results page, we store your email address until the appointment has been arranged (see "Consultation requests").
- Fonts, scripts and images are served exclusively from our own server. No data is sent to third parties.
- Your language and appearance choice and your cookie choice are stored only in your browser (local storage). They never leave your device. Via "Cookie settings" in the footer you can pick "Store no cookies" (nothing is stored), "Necessary cookies only", or withdraw your choice at any time.

## Cookies and storage access

| Entry | Purpose | Provider | Duration | Classification |
| --- | --- | --- | --- | --- |
| `ki-perspektiven.lang` (local storage) | Language choice | this website | until deleted | necessary: a function you explicitly choose (§ 25(2) TDDDG) |
| `ki-perspektiven.theme` (local storage) | Light or dark appearance | this website | until deleted | necessary: a function you explicitly choose |
| `ki-perspektiven.consent` (local storage) | Your cookie choice with time and version, no identifier | this website | at most 180 days | necessary to apply your decision |
| `ki_session` (cookie, HttpOnly) | Editorial sign-in | this website | session | necessary, only after you explicitly sign in under `/redaktion` |

## Server logs

When you open the site, our server processes technically necessary data such as the requested address and the time. IP addresses are shortened in the access log and logs are deleted after seven days.

## Statistics

**Page views.** To understand the reach of the website and repeated requests, our server counts each request for a public page. Absolute counts are stored as daily totals. For the deduplicated count, the IP address from the connection already needed to serve the page is normalised and immediately derived using a secret key (HMAC-SHA-256). No plain IP address is stored for these statistics. Each derivation has only its most recent request date, with no history of pages visited, exact times or browser details. Derivations are not linked to accounts, results or consultation requests and are not passed to third parties. Only signed-in editorial accounts see aggregate counts.

The derivation is a personal-data pseudonym, not an anonymous identifier. It and the separately protected key are retained for the lifetime of the statistics dataset so that an IP returning after a long absence is counted only once in the all-time total. When IP statistics are discontinued or reset, derivations and the key are deleted; backups follow their rotation. We review the need for this retention annually. Daily aggregate counts may remain. Several people can share one IP, and one person can use different IPs; the deduplicated count therefore does not measure unique people.

Nothing additional is stored in or read from your browser. We count the page request sent anyway. Navigation within the open website is not counted; automated requests are included. The legal basis for server-side IP deduplication is our legitimate interest in meaningful reach statistics (Art. 6(1)(f) GDPR). You may object on grounds relating to your particular situation under Art. 21 GDPR by contacting us using the details in the legal notice.

**Self-assessment results.** At the end of the AI readiness self-assessment you can choose to tick a box so that your result is stored anonymously. We use the results to understand what our audience needs and to improve the content. Only if the box is ticked does the page send, when your results are shown:

| Stored | Not stored |
| --- | --- |
| the level you chose (1 to 3) for each dimension, the language of the page, the time it was stored | your name, email address, IP address, browser or any other identifier of you |

So that a changed result is updated rather than stored twice, the page creates a random identifier. It is kept only in the memory of this browser window, not in cookies or local storage, and is lost when you reload or close the page. We only store an irreversible hash of it. If you untick the box while the window is open, we delete the result immediately. After that it can no longer be linked to anyone and therefore can no longer be deleted individually.

The legal basis for sending the result is your consent (§ 25(1) TDDDG). If the box is not ticked, nothing is sent and you still see your full results.

## Consultation requests

On the results page of the AI readiness self-assessment you can choose to request a free consultation. The page only sends your request to our server when you submit the form. We use it solely to contact you by email and arrange an appointment.

| Stored | Not stored |
| --- | --- |
| your email address, the language of the page (for our reply), the time of the request | your self-assessment result, name, IP address, browser or any other details |

The request is kept in the database on our server and is visible only to signed-in editorial accounts. If you send another request with the same address, we update the existing entry. Once the appointment has been arranged, we delete the request. On request, we delete it earlier at any time.

To prevent large numbers of other people's addresses from being entered, the server accepts at most five requests per IP address per hour. For this it keeps the IP address in memory for at most one hour; it is not stored and not linked to the request.

The legal basis for the request is Art. 6(1)(b) GDPR (steps taken at your request prior to a possible contract); for the limit per IP address it is our legitimate interest in operating the service without abuse (Art. 6(1)(f) GDPR). Without a request nothing is sent, and your results remain fully accessible.

## Hosting

The website runs on a server operated by Hetzner Online GmbH in Germany.

## Controller

[Name, address, contact]
