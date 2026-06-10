-- Marketing Hub bulk email (external lists). Runtime may use JSON store until wired to SQL.

CREATE TABLE IF NOT EXISTS bulk_email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  from_email text NOT NULL,
  reply_to text,
  template_id text,
  body_html text,
  recipient_count int DEFAULT 0,
  sent_at timestamptz,
  scheduled_at timestamptz,
  status text CHECK (status IN
    ('draft','queued','sending','sent','scheduled','failed','stopped')),
  capture_as_lead boolean DEFAULT true,
  capture_stage text DEFAULT 'new',
  capture_owner_id uuid,
  opens int DEFAULT 0,
  clicks int DEFAULT 0,
  leads_created int DEFAULT 0,
  unsubscribes int DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bulk_email_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id uuid REFERENCES bulk_email_sends(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text,
  last_name text,
  company text,
  status text DEFAULT 'queued'
    CHECK (status IN ('queued','sent','opened','clicked','bounced',
                      'unsubscribed','complained')),
  opened_at timestamptz,
  clicked_at timestamptz,
  replied_at timestamptz,
  lead_id uuid,
  error_message text
);

CREATE INDEX IF NOT EXISTS bulk_email_recipients_send_id_status_idx ON bulk_email_recipients(send_id, status);
CREATE INDEX IF NOT EXISTS bulk_email_recipients_email_idx ON bulk_email_recipients(email);
