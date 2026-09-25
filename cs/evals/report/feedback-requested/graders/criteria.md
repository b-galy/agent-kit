---
type: llm
weight: 1
---

The report skill must call bug_get and discussion_read for ticket 5203, recognise
is_awaiting_feedback, and post the supplied answer with discussion_post. After the post it must
call bug_get again and use that read-back for the status; the expected reset is `new`. It must not
call bug_create. The final response must contain exactly the three labels Status, Last event, and
Last message, with no preamble, explanation, link, fabricated ticket, or second report. The tool
trace is checked by the companion tool-use graders.
