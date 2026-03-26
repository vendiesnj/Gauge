# Connector strategy

## GitHub
Best implemented as a GitHub App so customers can install it for selected repos. This starter does not include the full GitHub App auth flow.

## Billing permissions
Yes, some users will grant account permissions through an OAuth or consent popup **if** the value is obvious and the required scopes are narrow. In practice, you should show:
- why you need access
- which objects you read
- whether billing data is exact vs inferred
- a clear revoke path

## Provider realities
There is no universal "get plan type" API across vendors. Some support account metadata access. Some only expose usage. Some expose invoices. Some require manual entry or CSV import.
