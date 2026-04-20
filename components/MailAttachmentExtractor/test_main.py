import os
import base64
from pathlib import Path
from unittest.mock import patch, MagicMock
from main import load_config, process_part, extract_attachments

def test_load_config(monkeypatch):
    monkeypatch.setenv("TARGET_EMAIL_ADDRESSES", "test1@bank.com, test2@bank.com")
    monkeypatch.setenv("OUTPUT_DIR", "/tmp/output")
    
    config = load_config()
    assert getattr(config, 'get', None) is not None
    assert config["TARGET_EMAILS"] == ["test1@bank.com", "test2@bank.com"]
    assert str(config["OUTPUT_DIR"]) in ("/tmp/output", "/private/tmp/output")
    
def test_process_part(tmp_path):
    # Setup mock service
    mock_service = MagicMock()
    mock_attachments_get = mock_service.users.return_value.messages.return_value.attachments.return_value.get
    mock_execute = mock_attachments_get.return_value.execute
    
    # Base64 encode some dummy data
    dummy_data = b"dummy pdf content"
    b64_data = base64.urlsafe_b64encode(dummy_data).decode('utf-8')
    mock_execute.return_value = {'data': b64_data}
    
    part = {
        'filename': 'statement.pdf',
        'body': {'attachmentId': 'att_123'}
    }
    
    process_part(service=mock_service, user_id='me', msg_id='msg_1', part=part, output_dir=tmp_path)
    
    # Assert file was created
    expected_file = tmp_path / "msg_1_statement.pdf"
    assert expected_file.exists()
    assert expected_file.read_bytes() == dummy_data
    
def test_process_part_skip_existing(tmp_path, capsys):
    mock_service = MagicMock()
    
    part = {
        'filename': 'statement.pdf',
        'body': {'attachmentId': 'att_123'}
    }
    
    expected_file = tmp_path / "msg_1_statement.pdf"
    expected_file.write_bytes(b"existing content")
    
    process_part(service=mock_service, user_id='me', msg_id='msg_1', part=part, output_dir=tmp_path)
    
    # The file should still have the exact same content, meaning it was skipped
    assert expected_file.read_bytes() == b"existing content"
    
    out, _ = capsys.readouterr()
    assert "already exists. Skipping." in out
    
def test_extract_attachments(tmp_path):
    mock_service = MagicMock()
    
    # Setup mock list of messages
    mock_list_execute = mock_service.users.return_value.messages.return_value.list.return_value.execute
    mock_list_execute.return_value = {
        'messages': [{'id': 'msg_1'}]
    }
    
    # Setup mock get message
    mock_get_execute = mock_service.users.return_value.messages.return_value.get.return_value.execute
    mock_get_execute.return_value = {
        'id': 'msg_1',
        'payload': {
            'parts': [
                {
                    'filename': 'test.txt',
                    'body': {'attachmentId': 'att_123'}
                }
            ]
        }
    }
    
    # Setup mock attachment get
    mock_attach_execute = mock_service.users.return_value.messages.return_value.attachments.return_value.get.return_value.execute
    dummy_data = b"hello"
    mock_attach_execute.return_value = {'data': base64.urlsafe_b64encode(dummy_data).decode('utf-8')}
    
    config = {
        "TARGET_EMAILS": ["bank@example.com"],
        "OUTPUT_DIR": tmp_path,
    }
    
    extract_attachments(mock_service, config)
    
    expected_file = tmp_path / "msg_1_test.txt"
    assert expected_file.exists()
    assert expected_file.read_bytes() == b"hello"
