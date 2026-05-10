import os
import sys
import base64
import re
import sqlite3
import json
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.auth.exceptions import RefreshError

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def get_emails_from_db():
    db_path = Path(__file__).parent.parent.parent / "data" / "preferences.db"
    if not db_path.exists():
        return []
    
    emails = set()
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT details FROM user_assets WHERE asset_type IN ('card', 'bank')")
        for row in cursor.fetchall():
            try:
                details = json.loads(row[0])
                email = details.get('statement_email')
                if email and email.strip():
                    emails.add(email.strip())
            except json.JSONDecodeError:
                pass
        conn.close()
    except Exception as e:
        print(f"Failed to read from db: {e}")
        
    return list(emails)

def load_config():
    # Load separate .env just for this service
    env_path = Path(__file__).parent / '.env'
    load_dotenv(dotenv_path=env_path)
    
    # By default, save to data/card_statements_locked at the project root
    # MailAttachmentExtractor is in components/MailAttachmentExtractor, so root is ../../
    default_output = Path(__file__).parent.parent.parent / "data" / "card_statements_locked"
    
    env_emails = [email.strip() for email in os.getenv("TARGET_EMAIL_ADDRESSES", "").split(",") if email.strip()]
    db_emails = get_emails_from_db()
    all_emails = list(set(env_emails + db_emails))
    
    return {
        "CREDENTIALS_PATH": os.getenv("GOOGLE_CREDENTIALS_PATH", "credentials.json"),
        "TOKEN_PATH": os.getenv("GOOGLE_TOKEN_PATH", "token.json"),
        "TARGET_EMAILS": all_emails,
        "OUTPUT_DIR": Path(os.getenv("OUTPUT_DIR", str(default_output))).resolve()
    }

def authenticate_gmail(config):
    creds = None
    token_path = config["TOKEN_PATH"]
    credentials_path = config["CREDENTIALS_PATH"]
    
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
        
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except RefreshError:
                print("Token expired or invalid, requesting new authorization...")
                if os.path.exists(token_path):
                    os.remove(token_path)
                
                if not os.path.exists(credentials_path):
                    raise FileNotFoundError(f"Credentials file not found at {credentials_path}. Please download it from Google Cloud Console.")
                    
                flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
                creds = flow.run_local_server(port=0)
        else:
            if not os.path.exists(credentials_path):
                raise FileNotFoundError(f"Credentials file not found at {credentials_path}. Please download it from Google Cloud Console.")
                
            flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
            creds = flow.run_local_server(port=0)
            
        with open(token_path, 'w') as token:
            token.write(creds.to_json())
            
    return build('gmail', 'v1', credentials=creds)

def parse_parts(service, user_id, msg_id, parts, output_dir, metadata):
    for part in parts:
        if part.get('filename'):
            process_part(service, user_id, msg_id, part, output_dir, metadata)
        if 'parts' in part:
            parse_parts(service, user_id, msg_id, part['parts'], output_dir, metadata)

def process_part(service, user_id, msg_id, part, output_dir, metadata):
    filename = part.get('filename')
    body = part.get('body', {})
    attachment_id = body.get('attachmentId')

    if not filename or not attachment_id:
        return
        
    # Extract Bank Name from sender
    bank = "UnknownBank"
    sender = metadata.get('sender', '').lower()
    if "hsbc" in sender: bank = "HSBC"
    elif "combank" in sender: bank = "ComBank"
    elif "dfcc" in sender: bank = "DFCC"
    elif "boc.lk" in sender: bank = "BOC"
    elif "hnb.lk" in sender: bank = "HNB"
    
    # Sanitize subject
    subject = metadata.get('subject', 'Statement')
    # Remove special characters from filenaming
    subject_slug = re.sub(r'[^\w\s-]', '', subject).strip().replace(' ', '_')[:30]
    
    period = metadata.get('period', 'unknown_date')
    
    # Construct descriptive filename: BANK_YYYY-MM_Subject_OriginalName
    # Using msg_id at the end to ensure uniqueness without breaking prefix-based sorting
    new_filename = f"{bank}_{period}_{subject_slug}_{filename}"
    # Remove any potentially dangerous characters or long paths
    new_filename = re.sub(r'[/\\?%*:|"<>]', '-', new_filename)
    
    filepath = output_dir / new_filename
    
    print(f"Processing: {new_filename}")
    
    if filepath.exists():
        print(f"File already exists. Skipping.")
        return
    
    try:
        attachment = service.users().messages().attachments().get(
            userId=user_id, messageId=msg_id, id=attachment_id).execute()
            
        if 'data' in attachment:
            file_data = base64.urlsafe_b64decode(attachment['data'].encode('UTF-8'))
            
            with open(filepath, 'wb') as f:
                f.write(file_data)
                
            print(f"Saved: {filepath}")
    except HttpError as error:
        print(f"Failed to download attachment {filename}: {error}")

def extract_attachments(service, config):
    output_dir = config["OUTPUT_DIR"]
    os.makedirs(output_dir, exist_ok=True)
    
    target_emails = config["TARGET_EMAILS"]
    
    if not target_emails:
        print("No target email addresses configured. Please set TARGET_EMAIL_ADDRESSES in .env")
        return

    from_query = " OR ".join([f"from:{email}" for email in target_emails])
    query = f"({from_query}) has:attachment"
    
    print(f"Searching Gmail with query: {query}")
    
    try:
        results = service.users().messages().list(userId='me', q=query).execute()
        messages = results.get('messages', [])
        
        if not messages:
            print('No messages found matching criteria.', file=sys.stderr)
            return

        print(f"Found {len(messages)} messages. Processing...")

        for message in messages:
            msg_id = message['id']
            msg = service.users().messages().get(userId='me', id=msg_id).execute()
            
            # Extract metadata from headers
            headers = msg.get('payload', {}).get('headers', [])
            subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), "No Subject")
            sender = next((h['value'] for h in headers if h['name'].lower() == 'from'), "Unknown")
            
            # Use internalDate for consistent period extraction (ms since epoch)
            internal_date = int(msg.get('internalDate', 0)) / 1000
            period = datetime.fromtimestamp(internal_date).strftime('%Y-%m')
            
            metadata = {
                "subject": subject,
                "sender": sender,
                "period": period
            }
            
            payload = msg.get('payload', {})
            
            if payload.get('filename'):
                process_part(service, 'me', msg_id, payload, output_dir, metadata)
                
            if 'parts' in payload:
                parse_parts(service, 'me', msg_id, payload['parts'], output_dir, metadata)

    except HttpError as error:
        print(f'An error occurred: {error}')

def scan_emails_for_attachments():
    """Main entrypoint for Prefect pipeline integration later"""
    config = load_config()
    service = authenticate_gmail(config)
    extract_attachments(service, config)
    return True

if __name__ == '__main__':
    try:
        scan_emails_for_attachments()
    except Exception as e:
        print(f"Execution failed: {e}", file=sys.stderr)
