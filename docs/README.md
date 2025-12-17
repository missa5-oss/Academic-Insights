# Documentation

This folder contains architecture and design documentation for Academic-Insights.

## Active Documentation

### [AGENTIC_EXTRACTION_ARCHITECTURE.md](AGENTIC_EXTRACTION_ARCHITECTURE.md)
- **Purpose**: Visual system architecture and data flow diagrams
- **Format**: Mermaid flowcharts and sequence diagrams
- **Covers**:
  - System overview (Frontend → Backend → External Services)
  - Extraction flow with verification agent
  - Retry logic and exponential backoff
  - Program variation retry strategy
  - Verifier agent rule-based checks
  - AI verification flow
  - Confidence score determination
  - Database schema (ERD)
  - Error handling flow
- **Use This When**: Understanding how the system components interact visually

### [AGENTIC_EXTRACTION_PROPOSAL.md](AGENTIC_EXTRACTION_PROPOSAL.md)
- **Purpose**: Technical design proposal and rationale for the extraction system
- **Covers**:
  - Problem analysis (why we need multi-agent extraction)
  - Design decisions and trade-offs
  - Generator-Critic pattern explanation
  - Phase 1 & 2 implementation details
  - API design and integration points
  - Risk assessment and mitigations
- **Use This When**: Understanding design decisions and technical rationale

## Development Roadmap

See [scrum/](scrum/) folder for sprint planning and implementation guides:
- `PHASE_2_SCRUM_PLAN.md` - Sprint-based development roadmap
- `SPRINT_4_IMPLEMENTATION.md` - Security hardening implementation guide

## Quick Reference

**See CLAUDE.md for:**
- Quick start setup and running instructions
- Architecture overview and tech stack
- Key file locations
- Data models
- Common debugging issues

**See code comments for:**
- Implementation details of specific functions
- API endpoint documentation
- Database schema details (in `server/db.js`)
