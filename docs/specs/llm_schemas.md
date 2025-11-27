# LLM Output Schemas

## Overview

All LLM outputs in the Everything Market platform must conform to strict schemas to ensure:
- **Provenance**: Every output is traceable to specific snapshots
- **Auditability**: All raw outputs are logged
- **Consistency**: Outputs are machine-parseable
- **Trustworthiness**: Confidence scores required

---

## Event Extraction Schema (v1)

All LLM outputs for event extraction MUST conform to this schema:

```json
{
  "summary": "string (required)",
  "snapshot_ids": ["64-char-hex-string"] (required, non-empty),
  "sources": ["URL or snapshot reference"] (required),
  "confidence": 0.0-1.0 (required),
  "schema_version": "v1" (required)
}
```

### Field Specifications

#### summary
- **Type**: string
- **Required**: Yes
- **Max length**: 500 characters
- **Description**: Concise, factual summary of the content
- **Example**: `"SpaceX successfully launched Starship on its 5th test flight, achieving orbital velocity for the first time."`

#### snapshot_ids
- **Type**: array of strings
- **Required**: Yes
- **Must be non-empty**: Yes
- **Format**: Each string MUST be 64-character hexadecimal (SHA-256)
- **Provenance requirement**: MUST include ALL input snapshot_ids
- **Validation**: System will reject output if snapshot_ids don't match stored snapshots
- **Example**: `["f56c358fa8c797cedb88f0a7a932a42ed9f38a121679a6db8b11aef889e7103a"]`

#### sources
- **Type**: array of strings
- **Required**: Yes
- **Description**: Canonical URLs or snapshot references
- **Preference**: Use `snapshot:<snapshot_id>` format over free-form URLs
- **Example**: `["https://spacex.com/updates/starship-flight-5", "snapshot:f56c358fa..."]`

#### confidence
- **Type**: number (float)
- **Required**: Yes
- **Range**: 0.0 (no confidence) to 1.0 (high confidence)
- **Guidelines**:
  - Use < 0.5 for uncertain extractions
  - Use 0.7-0.9 for typical extractions
  - Use > 0.9 only for verified facts
- **Example**: `0.95`

#### schema_version
- **Type**: string
- **Required**: Yes
- **Value**: Must be `"v1"`
- **Note**: Future schema changes will increment version

---

## Validation Rules

The system enforces these rules on all LLM outputs:

1. ✅ **All required fields must be present**
2. ✅ **Types must match exactly** (no coercion)
3. ✅ **`snapshot_ids` array must be non-empty**
4. ✅ **Each `snapshot_id` must match `/^[a-f0-9]{64}$/`**
5. ✅ **All input snapshot_ids must appear in output** (provenance)
6. ✅ **Confidence must be in range [0.0, 1.0]**
7. ✅ **Schema version must be "v1"**

**Outputs failing validation are rejected and logged to `llm_raw/` for analysis.**

---

## Examples

### Example 1: Valid Output

```json
{
  "summary": "SpaceX successfully launched Starship on its 5th test flight, achieving orbital velocity for the first time.",
  "snapshot_ids": [
    "f56c358fa8c797cedb88f0a7a932a42ed9f38a121679a6db8b11aef889e7103a",
    "a92bd4c1e3f5a6b8c9d0e1f2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2"
  ],
  "sources": [
    "https://spacex.com/updates/starship-flight-5",
    "snapshot:f56c358fa8c797cedb88f0a7a932a42ed9f38a121679a6db8b11aef889e7103a"
  ],
  "confidence": 0.95,
  "schema_version": "v1"
}
```

✅ **Valid**: All fields present and correctly formatted

---

### Example 2: Invalid Output - Empty snapshot_ids

```json
{
  "summary": "SpaceX launch successful",
  "snapshot_ids": [],
  "sources": ["https://spacex.com"],
  "confidence": 0.8,
  "schema_version": "v1"
}
```

❌ **Rejected**: `snapshot_ids` array is empty

---

### Example 3: Invalid Output - Wrong confidence type

```json
{
  "summary": "SpaceX launch successful",
  "snapshot_ids": ["f56c358fa8c797cedb88f0a7a932a42ed9f38a121679a6db8b11aef889e7103a"],
  "sources": ["https://spacex.com"],
  "confidence": "high",
  "schema_version": "v1"
}
```

❌ **Rejected**: `confidence` must be number, not string

---

### Example 4: Invalid Output - Missing field

```json
{
  "summary": "SpaceX launch successful",
  "snapshot_ids": ["f56c358fa8c797cedb88f0a7a932a42ed9f38a121679a6db8b11aef889e7103a"],
  "confidence": 0.8,
  "schema_version": "v1"
}
```

❌ **Rejected**: Missing `sources` field

---

### Example 5: Invalid Output - Provenance violation

**Input snapshot_ids**: `["abc123...", "def456..."]`

**LLM output**:
```json
{
  "summary": "Summary text",
  "snapshot_ids": ["abc123..."],
  "sources": ["https://example.com"],
  "confidence": 0.9,
  "schema_version": "v1"
}
```

❌ **Rejected**: Missing required snapshot_id `def456...` (provenance violation)

---

## Error Handling

When validation fails:

1. **Exception thrown** with specific error message
2. **Raw output logged** to `llm_raw/{call_id}.json`
3. **Request rejected** (no partial acceptance)
4. **Metrics incremented** (validation_failures counter)

Example error messages:
- `"Invalid schema: missing or invalid summary"`
- `"Invalid schema: snapshot_ids must be array"`
- `"Provenance violation: missing required snapshot_id abc123..."`
- `"Invalid snapshot_id format: not-valid-hex"`

---

## Testing

### Valid Output Test
```typescript
const client = new HuggingFaceClient();
const output = await client.generateStructured(
  "Summarize this article",
  ["f56c358fa8c797cedb88f0a7a932a42ed9f38a121679a6db8b11aef889e7103a"]
);
// Should succeed and return LLMOutput
```

### Invalid Output Test
```typescript
try {
  await client.generateStructured("Summarize", []);
} catch (error) {
  // Should throw: "snapshot_ids are required"
}
```

---

## Future Schema Versions

When schema changes are needed:

1. Increment `schema_version` (e.g., `"v2"`)
2. Document changes in this file
3. Update validation logic in `hf_client.ts`
4. Maintain backward compatibility where possible
5. Update `docs/decisions.md` with rationale

---

## Raw Output Logging

All LLM calls are logged to `llm_raw/{call_id}.json` with:

```json
{
  "prompt": "Full prompt sent to LLM",
  "raw_output": "Raw response from LLM",
  "snapshot_ids": ["Input snapshot IDs"],
  "timestamp": "2025-11-25T10:00:00Z",
  "model": "mistralai/Mistral-7B-Instruct-v0.2"
}
```

**Purpose**: Audit trail, debugging, model performance analysis

---

## Summary

✅ **Strict schema enforcement**  
✅ **Provenance required** (snapshot_ids)  
✅ **All outputs audited** (logged to llm_raw/)  
✅ **Machine-parseable** (JSON)  
✅ **Confidence scoring** (0.0-1.0)  

**No free-form text accepted as canonical proof.**
