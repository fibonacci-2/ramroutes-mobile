# App Store Listing Copy: edgo

First-draft copy for App Store Connect. Character counts noted next to each
field's Apple limit; trim if you edit. Placeholders you need to fill in are
marked `[TODO]`.

## Promotional Text (170 char max, editable anytime without a new build)

```
Never miss what's happening on campus. See a live event map, get picks made
for you in For You, and ask Scout to find your next event.
```
(134 characters)

## Description (4000 char max)

```
edgo turns your campus into something you can actually see. Open the
map and every event happening around you shows up where it's happening.
Tap a hotspot to see what's going on at that building right now.

FOR YOU, MADE FOR YOU
edgo learns what you're into (your major, your interests, the events
you save) and quietly rebuilds your recommendations as you go. No endless
scrolling through things you don't care about. Just the events that
actually match you, always up to date.

FIND EVERYTHING ON ONE MAP
Every event on campus, plotted where it's happening. Busy buildings glow
so you can spot where the action is at a glance. Filter by category:
academic, sports, arts, social, food, career, cultural, spiritual, mental
health, greek life, sustainability. Zoom in for details.

ASK SCOUT
Not sure what you're in the mood for? Ask Scout, your campus event
assistant. Tell it what you're looking for, like "something chill this
weekend," "career stuff," or "anything free," and it'll point you to real
events happening on your campus, with context on why it picked them.

SAVE AND GET REMINDED
RSVP to events you're interested in, keep a running list of what you've
saved, and get notified when new events go up that match what you care
about, and when your recommendations actually change (not on every
little update).

BUILT FOR YOUR SCHOOL
edgo is scoped to your campus: you'll only ever see events, maps,
and recommendations for your own school.

Download edgo and stop missing out on what's happening around you.
```
(1,542 characters, well under the 4000 limit, room to expand)

## Keywords (100 char max, comma-separated, no spaces after commas)

```
campus,events,college,university,student,clubs,rsvp,map,scout,ai,social,activities,recommendations
```
(98 characters, 2 to spare if you want to add a school-specific term)

## Subtitle (30 char max, appears under the app name)

```
Campus events, made for you
```
(27 characters)

## Support URL

`[TODO]`: point this at wherever `support/index.html` (drafted alongside
this file) ends up hosted (GitHub Pages, Firebase Hosting, etc). App Store
Connect requires a live URL, not a local file.

## Privacy Policy URL (required)

`[TODO]`: point this at wherever `support/privacy.html` ends up hosted,
alongside the support page. App Store Connect requires a live URL here too,
and it's a hard submission blocker if missing.

## Marketing URL (optional)

`[TODO]`: leave blank if you don't have a marketing site yet; not required.

## Category suggestion

Primary: **Education** or **Social Networking** (Education fits the
campus-events framing better; Social Networking fits if you want to lean
into the RSVP/social angle). Secondary: **Lifestyle**.

## Privacy Policy (raw text)

Plain-text version of `support/privacy.html`, for anywhere App Store
Connect or App Privacy questionnaires ask for policy text directly instead
of a URL. Same `[TODO]`s as the HTML page: fill in support email and
year/company name in both places together so they stay in sync.

```
edgo Privacy Policy
Last updated: [TODO: date]

edgo ("edgo," "we," "us") helps students discover events
happening on their campus. This policy explains what information the app
collects, why, and how it's handled. edgo is built for use by
students at a specific school and only shows you data scoped to that
school.

INFORMATION WE COLLECT

Account information
When you sign in, we create an account via Firebase Authentication. This
may include your email address or other identifiers tied to your sign-in
method.

Profile information
Information you choose to add to your profile, used to personalize your
event recommendations:
- Bio / free-text description
- Major
- Class year
- Interest tags (e.g. academic, sports, arts, social, career, cultural,
  sustainability)
- Your selected school

Location
With your permission, edgo uses your device's precise location to
show your position on the campus map, calculate distance to events, and
(if you grant background location access) notify you about events
happening at buildings near you. You can grant, deny, or revoke location
access at any time in your device settings. Location is not required to
use the app: you can browse and search events without it.

Event activity
Events you save or RSVP to, so we can show you your saved list and
improve your recommendations.

Scout chat messages
If you use Scout (the in-app assistant), the messages you send and recent
conversation history are processed to generate a reply. See "Third-party
services" below for how this is handled.

Push notification token
A device token issued by Apple/Google's push notification service, used
to deliver notifications about new events and recommendation updates. You
can disable notifications at any time in your device settings.

Diagnostic information
Standard technical data generated by our infrastructure providers (e.g.
request logs, crash data) as described below.

HOW WE USE THIS INFORMATION
- To show you events happening at your school
- To generate your personalized "For You" recommendations, and to notify
  you when they meaningfully change
- To power Scout's replies to your questions
- To show your location and nearby events on the map
- To send you notifications about new events and updates you've opted
  into
- To maintain and secure the app

We do not sell your personal information, and we do not use it for
third-party advertising.

THIRD-PARTY SERVICES
edgo relies on the following services to operate. Each processes a
limited slice of data, only as needed to perform its function:

- Google Firebase (Authentication, Firestore, Cloud Functions, Cloud
  Messaging), used for account sign-in, storing your profile and event
  data, running recommendation logic, and delivering push notifications.
  Receives: account identifiers, profile data, event activity, push
  token.

- Google Maps, used for rendering the campus map and your position on
  it. Receives: location data needed to display the map, per Google's
  standard SDK behavior.

- OpenRouter (AI model provider), used for generating Scout's replies
  and computing recommendation matching in the background. Receives: your
  message text and recent chat history when you use Scout; event and
  profile text used to compute recommendation matching. Requests are made
  from our servers, not directly from your device, and do not include
  your name, email, or account identifiers.

Each provider handles data under its own privacy policy. We only share
what's necessary for the feature to work.

DATA RETENTION
We retain your profile and event activity for as long as your account is
active, so the app can keep showing you relevant recommendations. If you
delete your account (see below), we delete the associated profile and
activity data within a reasonable time, except where retention is
required for legal or security purposes.

YOUR CHOICES
- Location: grant or revoke at any time in your device's Settings app.
- Notifications: grant or revoke at any time in your device's Settings
  app.
- Profile data: edit or clear your bio, major, class year, and interests
  at any time from within the app.
- Delete your account: email us at [TODO: support email] and we'll
  delete your account and associated data.

CHILDREN'S PRIVACY
edgo is intended for college and university students and is not
directed at children under 13. We do not knowingly collect information
from children under 13.

SECURITY
We rely on Firebase's built-in security infrastructure (authentication,
encrypted transport, access-controlled data storage) to protect your
information. No method of transmission or storage is 100% secure, but we
work to use commercially reasonable safeguards.

CHANGES TO THIS POLICY
If we make material changes to this policy, we'll update the "Last
updated" date above. Continued use of the app after changes take effect
constitutes acceptance of the updated policy.

CONTACT US
Questions about this policy or your data? Reach out: [TODO: support
email]

edgo · [TODO: year / company name]
```

## Support Page (raw text)

Plain-text version of `support/index.html`, in case a submission form
asks for support content directly instead of a URL. Same `[TODO]`s as the
HTML page: fill in support email and year/company name in both places
together so they stay in sync.

```
edgo Support
Campus events, made for you

Contact us
Running into a problem, have feedback, or need to report an issue? Reach
out and we'll get back to you.
[TODO: support email]

Frequently asked questions

Why don't I see any events?
edgo only shows events for your own school. Make sure you selected the
right school when you first opened the app. If your school's events
haven't been posted yet, check back soon; new events are added regularly.

How does the "For You" list work?
edgo looks at your major, interests, and the events you save to build a
personalized list of recommended events. It updates automatically as your
profile changes, so keep your interests up to date in the profile tab for
the best picks.

What is Scout?
Scout is edgo's built-in assistant. Ask it things like "something fun
this weekend" or "career events" and it'll suggest real events happening
on your campus.

How do I save an event?
Open any event's detail page and tap the save/RSVP button. Saved events
show up in your Saved list, accessible from the profile tab.

How do I stop getting notifications?
You can manage notification permissions for edgo at any time in your
device's Settings app, under Notifications, edgo.

How do I delete my account or data?
Email us at [TODO: support email] from the address associated with your
account and we'll remove your data.

edgo · [TODO: year / company name]
```
