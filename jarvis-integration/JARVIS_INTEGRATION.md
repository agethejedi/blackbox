# Black Box — JARVIS Integration Guide

## Files to add to JARVIS repo

- `src/components/BlackBoxPanel.jsx` (included in this package)

---

## 1. JarvisBriefing.jsx — imports

Add at top with other panel imports:
```javascript
import BlackBoxPanel from "./BlackBoxPanel.jsx";
```

## 2. JarvisBriefing.jsx — state

Add alongside taniaOpen state:
```javascript
const [blackBoxOpen, setBlackBoxOpen] = useState(false);
const [blackBoxAction, setBlackBoxAction] = useState(null);
```

## 3. JarvisBriefing.jsx — JSX

Add alongside TaniaPanel in the JSX:
```jsx
<BlackBoxPanel
  isOpen={blackBoxOpen}
  onClose={() => { setBlackBoxOpen(false); setBlackBoxAction(null); }}
  initialAction={blackBoxAction}
/>
```

## 4. JarvisBriefing.jsx — executeToolCall switch

Add these cases before the default case:
```javascript
case "activate_blackbox": {
  setBlackBoxOpen(true);
  setBlackBoxAction(null);
  return JSON.stringify({ ok: true });
}
case "close_blackbox": {
  setBlackBoxOpen(false);
  setBlackBoxAction(null);
  return JSON.stringify({ ok: true });
}
case "blackbox_analyze":
case "blackbox_coach":
case "blackbox_search": {
  setBlackBoxOpen(true);
  setBlackBoxAction({ type: name, payload: input });
  return JSON.stringify({ ok: true, note: "Executed server-side" });
}
```

## 5. chat.js — add to TOOLS array

```javascript
{
  name: "activate_blackbox",
  description: "Open the Black Box relationship intelligence panel. Use when Ron says 'open Black Box', 'activate Black Box', or 'launch Black Box'.",
  input_schema: { type: "object", properties: {} },
},
{
  name: "close_blackbox",
  description: "Close the Black Box panel and return to JARVIS dashboard. Use when Ron says 'close Black Box', 'stand down Black Box', or 'back to JARVIS'.",
  input_schema: { type: "object", properties: {} },
},
{
  name: "blackbox_analyze",
  description: "Open Black Box and send a conversation for analysis.",
  input_schema: {
    type: "object",
    properties: {
      conversation_text: { type: "string" },
      title: { type: "string" },
    },
    required: ["conversation_text"],
  },
},
{
  name: "blackbox_coach",
  description: "Open Black Box Coach Mode with a draft response.",
  input_schema: {
    type: "object",
    properties: {
      draft: { type: "string" },
      context: { type: "string" },
    },
    required: ["draft"],
  },
},
{
  name: "blackbox_search",
  description: "Open Black Box Smart History with a search query.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string" },
    },
    required: ["query"],
  },
},
```

## 6. chat.js — add to tool execution routing

Add to the array of server-side tool names:
```javascript
if (["activate_blackbox", "close_blackbox", "blackbox_analyze", "blackbox_coach", "blackbox_search",
     "deploy_project", "push_files", ...].includes(block.name)) {
```

## 7. chat.js — add to system prompt OPERATOR CAPABILITIES

```
### Black Box
Black Box is a JARVIS subagent for relationship communication intelligence.
- "Open Black Box" / "Activate Black Box" / "Launch Black Box" → activate_blackbox
- "Close Black Box" / "Stand down Black Box" / "Back to JARVIS" → close_blackbox
- "Run this through Black Box" / "Analyze this conversation" → blackbox_analyze
- "Coach this response" / "Check this message" → blackbox_coach
- "Search Black Box for X" / "Find conversations about X" → blackbox_search
```

## 8. JarvisSphere.jsx — add Orchestrator node

Add "blackbox" to the projects array with color #7c3aed (deep purple).
Label: "BLACK BOX"
Position it as the seventh node.

---

## Cloudflare env vars needed for jarvis-blackbox Pages project

- OPENAI_API_KEY
- DB (D1 binding — database name: BLACKBOX_MEMORY)
- BLACKBOX_UPLOADS (R2 binding)
- BLACKBOX_AUDIO (R2 binding)
- BLACKBOX_REPORTS (R2 binding)
