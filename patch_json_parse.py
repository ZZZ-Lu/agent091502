import re

with open('server.ts', 'r') as f:
    code = f.read()

target_str = """              const body = await parseResponse.json();
              const parsed = JSON.parse(body.choices[0].message.content || '{}');
              if (Array.isArray(parsed.tool_calls)) {"""

new_str = """              const body = await parseResponse.json();
              let content = body.choices[0].message.content || '{}';
              content = content.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
              const parsed = JSON.parse(content);
              if (Array.isArray(parsed.tool_calls)) {"""

code = code.replace(target_str, new_str)

with open('server.ts', 'w') as f:
    f.write(code)
