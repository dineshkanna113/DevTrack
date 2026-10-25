from functools import lru_cache
from typing import Annotated

import anthropic
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DbSession, MemberProject
from app.core.config import get_settings
from app.models import Issue, IssueStatus
from app.schemas import DuplicateCandidate, TriageRequest, TriageResponse
from app.services.ai_triage import ClaudeTriager, ExistingIssue, TriageError, Triager

router = APIRouter(tags=["ai"])

MAX_DUPLICATE_CANDIDATES = 50


@lru_cache
def _claude_triager() -> ClaudeTriager:
    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key, timeout=60.0)
    return ClaudeTriager(client, settings.ai_model)


def get_triager() -> Triager:
    if not get_settings().ai_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI features are disabled (ANTHROPIC_API_KEY not configured)",
        )
    return _claude_triager()


@router.post("/projects/{project_id}/ai/triage", response_model=TriageResponse)
def triage_issue(
    data: TriageRequest,
    project: MemberProject,
    db: DbSession,
    triager: Annotated[Triager, Depends(get_triager)],
) -> TriageResponse:
    """Suggest type, priority, a cleaner title, and likely duplicates for a draft issue."""
    open_issues = db.scalars(
        select(Issue)
        .where(Issue.project_id == project.id, Issue.status != IssueStatus.DONE)
        .order_by(Issue.created_at.desc())
        .limit(MAX_DUPLICATE_CANDIDATES)
    ).all()
    candidates = {i.id: ExistingIssue(id=i.id, key=i.key, title=i.title) for i in open_issues}

    try:
        suggestion = triager.triage(data.title, data.description, list(candidates.values()))
    except TriageError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    return TriageResponse(
        type=suggestion.type,
        priority=suggestion.priority,
        suggested_title=suggestion.suggested_title,
        summary=suggestion.summary,
        reasoning=suggestion.reasoning,
        duplicates=[
            DuplicateCandidate(id=c.id, key=c.key, title=c.title)
            for i in suggestion.duplicate_issue_ids
            if (c := candidates.get(i))
        ],
    )
