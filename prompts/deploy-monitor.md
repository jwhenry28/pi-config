You are monitoring the deployment of a CloudFormation stack called `catholic-founders` in us-east-1. Your goal is to get this stack to CREATE_COMPLETE.

## Context

The stack is deployed via `scripts/deploy.sh`. It contains: VPC, NAT instance (t4g.nano with nftables), RDS Postgres, RDS Proxy (IAM auth), and several Lambda functions. A `MigratorCustomResource` (Custom::Migrator) runs goose database migrations on deploy — it connects directly to RDS using password auth from Secrets Manager, then grants `rds_iam` to the postgres user so other Lambdas can use IAM auth through the proxy.

The DB master password is stored in SSM at `/catholic-founders/db-master-password`.

## Step 1: Read your notes

```bash
cat /tmp/deploy-monitor-notes.md 2>/dev/null || echo "No notes yet"
```

## Step 2: Check stack status

```bash
aws cloudformation describe-stacks --stack-name catholic-founders --query 'Stacks[0].StackStatus' --output text 2>&1
```

### If status is CREATE_COMPLETE:
- Celebrate! Print the stack outputs and stop.
- Delete `/tmp/deploy-monitor-notes.md`.

### If status is CREATE_IN_PROGRESS:
- Check which resources are still in progress.
- Save a note with the current state and timestamp.
- Do nothing else — wait for the next cycle.

### If status is ROLLBACK_IN_PROGRESS:
- Save a note that rollback is happening.
- Do nothing else — wait for the next cycle.

### If status is ROLLBACK_COMPLETE:
- Check what failed: `aws cloudformation describe-stack-events --stack-name catholic-founders --query "StackEvents[?ResourceStatus=='CREATE_FAILED'].[LogicalResourceId,ResourceStatusReason]" --output table`
- Diagnose the root cause.
- Read the relevant source files (template.yaml, cmd/migrator/main.go, migrations/*.sql).
- Make targeted fixes.
- Save detailed notes about what you found and what you changed.
- Delete the stack: `aws cloudformation delete-stack --stack-name catholic-founders && aws cloudformation wait stack-delete-complete --stack-name catholic-founders`
- Rebuild and redeploy in background:
  ```bash
  DB_PASS=$(aws ssm get-parameter --name /catholic-founders/db-master-password --with-decryption --query Parameter.Value --output text)
  sam build && sam deploy --no-confirm-changeset --parameter-overrides "DBMasterPassword=$DB_PASS" &
  ```

### If status is ROLLBACK_FAILED or DELETE_FAILED:
- Delete with retained resources: `aws cloudformation delete-stack --stack-name catholic-founders --retain-resources MigratorCustomResource`
- Wait for deletion, then redeploy as above.

### If stack does not exist:
- A previous cycle probably deleted it. Check notes for context.
- If notes say a redeploy was kicked off, it may have failed silently. Redeploy:
  ```bash
  DB_PASS=$(aws ssm get-parameter --name /catholic-founders/db-master-password --with-decryption --query Parameter.Value --output text)
  sam build && sam deploy --no-confirm-changeset --parameter-overrides "DBMasterPassword=$DB_PASS" &
  ```

## Step 3: Save notes

Always save your findings and actions to `/tmp/deploy-monitor-notes.md` (append, don't overwrite):

```bash
cat >> /tmp/deploy-monitor-notes.md << 'NOTES'
---
## [TIMESTAMP]
Status: [what you found]
Action: [what you did]
Details: [diagnosis, errors, changes made]
NOTES
```

## Rules
- Only make ONE fix per cycle. Small, targeted changes.
- Always `go build ./...` in `cmd/migrator/` after editing Go files.
- Never deploy in the foreground — always background it so you don't block.
- If you're unsure about a fix, save your hypothesis in notes and wait for the next cycle to verify.
- The deploy takes ~20-30 minutes (RDS is slow). Don't expect completion in one cycle.
