#!/usr/bin/env python3
"""PH12 fresh lexical SQL/DDL candidate audit; NEVER certifies semantic parity or phase acceptance."""
import argparse
import hashlib
import json
import os
import re
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
MIG=ROOT/"database/migrations"
FIELDS=ROOT/"docs/analysis/PH01_148_ENTITY_FIELD_PHYSICAL_CANDIDATES.json"
SOURCE=ROOT/"docs/analysis/PH01_SOURCE_148_ENTITY_FIELD_INDEX.json"
ACCEPTED=ROOT/"docs/analysis/PH01_155_ACCEPTANCE_EVIDENCE_GATE.json"
NAME=re.compile(r"^[a-z][a-z0-9_]*$")

def read(path):
    return json.loads(path.read_text(encoding="utf-8"))

def ddl_map():
    tables={}
    revisions=[]
    for file in sorted(MIG.glob("[0-9][0-9][0-9][0-9]*.sql")):
        text=file.read_text(encoding="utf-8")
        revisions.append({"migration":str(file.relative_to(ROOT)),
                          "sha256":hashlib.sha256(file.read_bytes()).hexdigest()})
        for match in re.finditer(
                r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:tto\.)?([a-z][a-z0-9_]*)\s*\(",
                text,re.I):
            table=match.group(1).lower()
            depth=1
            start=match.end()
            end=start
            while end<len(text) and depth:
                if text[end]=="(":depth+=1
                if text[end]==")":depth-=1
                end+=1
            if depth:continue
            segment=text[start:end-1]
            columns=tables.setdefault(table,set())
            for line in segment.splitlines():
                line=line.strip()
                c=re.match(r'^"?([a-z][a-z0-9_]*)"?\s+(?:text|varchar|character|uuid|integer|int|bigint|boolean|numeric|decimal|date|timestamp|jsonb?|bytea|citext|double|real|smallint|inet|time)\b',line,re.I)
                if c:columns.add(c.group(1).lower())
        for match in re.finditer(
                r"ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:tto\.)?([a-z][a-z0-9_]*)\s+ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([a-z][a-z0-9_]*)\s+",
                text,re.I):
            tables.setdefault(match.group(1).lower(),set()).add(match.group(2).lower())
    return tables,revisions

def audit(field_data,source_data,acceptance_data,tables,revisions):
    rows=field_data["rows"]
    assert len(rows)==field_data["field_phrases"]==786,"SOURCE_FIELD_COUNT_DRIFT"
    assert len({row["row_id"] for row in rows})==786,"DUPLICATE_FIELD_ROW_ID"
    assert source_data["entity_count"]==len(source_data["entities"])==148,"SOURCE_ENTITY_DRIFT"
    assert acceptance_data["acceptance_count"]==155
    assert acceptance_data["not_accepted_per_source"]==155,"FORMAL_ACCEPTANCE_NOT_EVIDENCED"
    assert len(revisions)>10,"MIGRATION_HISTORY_TRUNCATED"
    output=[]
    for row in rows:
        table=row.get("sql_table_candidate")
        col=row.get("sql_column_candidate")
        phrase=str(row.get("source_field_phrase") or "")
        if not isinstance(table,str) or not NAME.fullmatch(table):
            state="NO_DIRECT_TABLE_CANDIDATE"
        elif table not in tables:
            state="TABLE_NOT_OBSERVED_IN_CURRENT_DDL"
        elif not isinstance(col,str) or not NAME.fullmatch(col):
            state="UNRESOLVED_COLUMN_CANDIDATE"
        elif col.lower() in tables[table]:
            state="LEXICAL_DDL_CANDIDATE_NOT_SEMANTICALLY_CERTIFIED"
        else:
            state="CANDIDATE_COLUMN_NOT_OBSERVED_IN_DDL"
        assert row.get("actual_semantic_equivalence_certified") is not True,(
            "SOURCE_SEMANTIC_SIGNOFF_MUST_NOT_BE_INFERRED")
        output.append({
          "rowId":row["row_id"],"child":row["child"],
          "sourceEntity":row["source_entity"],
          "sourceFieldPhrase":phrase,
          "tableCandidate":table,"columnCandidate":col,
          "lexicalStatus":state,"semanticParityApproved":False,
          "legalAuthorityApproved":False})
    counts=Counter(x["lexicalStatus"] for x in output)
    assert sum(counts.values())==786
    return {"classification":"PH12_DDL_LEXICAL_CANDIDATES_ONLY_NOT_FULL_ENTITY_PARITY",
      "sourceEntities":148,"sourceFieldPhrases":786,"originalSourceAcceptances":155,
      "formalSourceAccepted":0,"migrationsScanned":len(revisions),
      "ddlTableNamesObserved":len(tables),"statusCounts":dict(sorted(counts.items())),
      "physicalSemanticParityAccepted":0,"release":"HOLD","rows":output,
      "migrationRevisions":revisions}

def main():
    args=argparse.ArgumentParser()
    args.add_argument("--output")
    options=args.parse_args()
    tables,revisions=ddl_map()
    out=audit(read(FIELDS),read(SOURCE),read(ACCEPTED),tables,revisions)
    if options.output:
        assert os.getenv("CI")=="true" and not os.getenv("VERCEL"),"CI_ONLY"
        dest=(ROOT/options.output).resolve()
        assert dest.parent==ROOT/"ph12-artifacts","UNSAFE_OUTPUT_PATH"
        dest.parent.mkdir(exist_ok=True)
        out["exactRun"]={"sha":os.environ["GITHUB_SHA"],
                         "id":os.environ["GITHUB_RUN_ID"]}
        dest.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("PH12_148_ENTITY_786_FIELDS_FRESH_SQL_LEXICAL_AUDIT_COMPLETE_SEMANTIC_ACCEPTANCE_ZERO")
    print(json.dumps({"migrationsScanned":out["migrationsScanned"],
     "ddlTables":out["ddlTableNamesObserved"],"counts":out["statusCounts"],
     "formalAccepted":out["formalSourceAccepted"],"release":out["release"]}))
if __name__=="__main__":
    main()
