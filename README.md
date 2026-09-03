# Business Ops

Build a dedicated CRM-like tool for my start up IO-Gen, which is not only a CRM but more of a over-all business operations management tool.

Key features/ menus

Dashboard - dashboard to track all of the items below. a feed for what's new would be good which should capture any activities done by any of the users. 

Business Development

CRM - more of a traditional CRM where we can add existing contacts/ clients with their contact details, organisations, etc. Allow for us to track potential leads.

Email Outreach - need be able to create separate "campaigns" or "outreach topics". Then for each campaign/topics we will need to be able to add/edit/remove contacts (with information such as name, email address, job title, organisation, website, industry), outreach status (first email, second email, third email - check boxes) with the ability to add dates against each outreach status, lead status e.g. no reply (default), requested a meeting, not interested, converted) and a  notes section. 

	From the email outreach section we need to be able to build email templates that can be shared/ attached to specific campaigns/topics (can be shared across multiple campaigns/topics or specific to one) with an option to confirm a template is approved. 

	For the contacts list for each campaign/topic also include an option to bulk upload an excel file for adding of contacts and the ability to export saved contacts. 

	In a separate Settings page > Email Outreach: add the ability to customise the fields for contacts (add/edit/delete new custom fields), outreach status (add/edit/delete dropdown options), lead status(add/edit/delete dropdown options) as well as an option for adding custom fields in general (text field, dropdown or checklist).

Social Planner - need to be able to add "plans" for upcoming social media posts. Starting a new one should include selecting the platform for posting (e.g. LinkedIn, Instagram, X, Threads), custom message copy, attachment for a graphic, scheduled post date, approval status (approved, not approved), post status (posted, not posted, cancelled).

Operations

Projects & Works - be able to add either a project or a work starting with title, description of project/ work (long text), project/ work cost, project status (in-progress, on-hold, cancelled), team lead (based off app users for the selection), priority (low, medium, high), client (based off organisation/contact list from CRM). project duration. Then within each project/ work should have a section for deliverables & milestones that users ticks off a milestone that's been completed. Pre built deliverables & milestones are initial enquiry, cost proposal submitted, order approved, order received, project completed, project invoiced. For deliverables & milestones add the ability to add a custom deliverables & milestones within the actual page but that should be exclusive only for the project it has been added. For each one of these deliverables and milestones including any custom ones add the ability for users to put a due date (by default blank), and a completed date which is automatically populated by the app when the users tick off a milestone.

	Include a section for cost to the business. This is where I can allocate of the total project/ work cost how much goes to the our business and how much goes to our supplier. 

	Similar to email outreach I want a setting for the fields for projects & works to be customisable as well as the option to new custom fields. 

Subscriptions - we are a SaaS company so a section for where we can keep track of the clients currently subscribed to io-gen, their subscription costs, and renewal date. Similar to the other menu give me option to add new custom fields in settings. 



Other Requests

Don't limit the app to what I've just specified. If you feel that there are some additional functionalities I haven't considered that would be helpful for the app feel free to add them.

Needs to be a collaborative tool with user authentication built in. Each aspect e.g. CRM, Email Outreach, Social Planner, Projects & Works needs to be items that can be assigned indivually per user. For the user authentication page, I don't need a sign up link as users will only be added by exisiting users.

Make sure to have a user management page where I can add, edit, remove users, update passwords, update page access. Make sure there is a built in password generator. Include a job title in the users page. There won't be user types because access will be determined by assignment of pages as per above. Use the io-gen logo attached. 

Simple clean design, be inspired by craft.do in terms of design and aesthetic. Use gradient shades of green and grey for colours. 

Incorporating a calendar would be good.

Notifications would be really good too.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://io-office.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ec3b3ca2-14be-456b-9707-ca7de88bb120).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
