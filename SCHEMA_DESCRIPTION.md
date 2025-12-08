# Case Management System - Entity Relationship Diagram

## Database Sections

This database is organized into three main sections:
1. **SUPPORTING** - Supporting tables for system configuration
2. **MAIN** - Core business entities
3. **SUPPORTING CASE DATA** - Case-related supporting data (not included in MVP)
4. **AUDIT** - Audit logging tables (not included in MVP)

---

## SUPPORTING Section

### CASE_STATUS
Lookup table for case statuses.

**Columns:**
- `status_id` (PK) - Primary key
- `name` - Status name

**Relationships:**
- Referenced by CASE.status_id (FK)

---

### PRACTICE_AREA
Lookup table for practice areas.

**Columns:**
- `practice_area_id` (PK) - Primary key
- `name` - Practice area name

**Relationships:**
- Referenced by CASE.practice_area_id (FK)

---

### ADDRESS
Physical addresses for clients and users.

**Columns:**
- `address_id` (PK) - Primary key
- `line1` - Address line 1
- `line2` - Address line 2
- `city` - City
- `state` - State
- `postal_code` - Postal/ZIP code
- `client_id` (FK) - Foreign key to CLIENT
- `user_id` (FK) - Foreign key to USER_ACCOUNT

**Relationships:**
- Links to CLIENT.client_id (FK)
- Links to USER_ACCOUNT.user_id (FK)

---

### ROLE
User roles in the system.

**Columns:**
- `role_id` (PK) - Primary key
- `name` (unique) - Role name
- `description` - Role description

**Relationships:**
- Referenced by USER_ROLE.role_id (FK)

---

### USER_ROLE
Junction table linking users to roles (many-to-many).

**Columns:**
- `role_id` (FK) - Foreign key to ROLE
- `user_id` (FK) - Foreign key to USER_ACCOUNT

**Relationships:**
- Links to ROLE.role_id (FK)
- Links to USER_ACCOUNT.user_id (FK)

---

## MAIN Section

### CASE
Central entity representing legal cases.

**Columns:**
- `case_id` (PK) - Primary key
- `title` - Case title
- `description` - Case description
- `opened_on` (date) - Date case was opened
- `closed_on` (date) - Date case was closed
- `priority` (enum) - Case priority level
- `reference_no` - Reference number
- `is_public_submission` (bool) - Whether case came from public submission
- `status_id` (FK) - Foreign key to CASE_STATUS
- `practice_area_id` (FK) - Foreign key to PRACTICE_AREA
- `client_id` (FK) - Foreign key to CLIENT

**Relationships:**
- Links to CASE_STATUS.status_id (FK)
- Links to PRACTICE_AREA.practice_area_id (FK)
- Links to CLIENT.client_id (FK)
- Referenced by CASE_ASSIGNMENT.case_id (FK)
- Referenced by APPOINTMENT.case_id (FK)
- Referenced by MESSAGE.case_id (FK)
- Referenced by DOCUMENT.case_id (FK)
- Referenced by CASE_NOTE.case_id (FK)
- Referenced by TASK.case_id (FK)

---

### CLIENT
Individuals or entities that are clients.

**Columns:**
- `client_id` (PK) - Primary key
- `first_name` - First name
- `last_name` - Last name
- `email` - Email address
- `phone` - Phone number
- `preferred_contact_method` - Preferred method of contact
- `created_on` - Date client record was created
- `user_id` (FK) - Foreign key to USER_ACCOUNT

**Relationships:**
- Links to USER_ACCOUNT.user_id (FK)
- Referenced by CASE.client_id (FK)
- Referenced by ADDRESS.client_id (FK)
- Referenced by APPOINTMENT.appointment_client (FK)
- Referenced by MESSAGE.recipient_client_id (FK)

---

### USER_ACCOUNT
System user accounts.

**Columns:**
- `user_id` (PK) - Primary key
- `email` (unique) - Email address
- `password_hash` - Hashed password
- `password_salt` - Password salt
- `first_name` - First name
- `last_name` - Last name
- `phone` - Phone number
- `is_active` (bool) - Whether account is active
- `created_on` (date) - Account creation date
- `updated_on` (date) - Last update date

**Relationships:**
- Referenced by CLIENT.user_id (FK)
- Referenced by ADDRESS.user_id (FK)
- Referenced by USER_ROLE.user_id (FK)
- Referenced by CASE_ASSIGNMENT.user_id (FK)
- Referenced by APPOINTMENT.appointment_user (FK)
- Referenced by MESSAGE.sender_user_id (FK)
- Referenced by DOCUMENT.uploader_user_id (FK)
- Referenced by CASE_NOTE.author_user_id (FK)
- Referenced by TASK.assignee_user_id (FK)
- Referenced by AUDIT_LOG.actor_user_id (FK)
- Referenced by LOGIN_AUDIT.user_id (FK)

---

## SUPPORTING CASE DATA Section (Not Included in MVP)

### CASE_ASSIGNMENT
Assignment of users to cases with roles.

**Columns:**
- `case_assignment_id` (PK) - Primary key
- `assignment_role` (enum) - Role in the case assignment
- `assigned_on` (date) - Date of assignment
- `unassigned_on` (date) - Date of unassignment
- `case_id` (FK) - Foreign key to CASE
- `user_id` (FK) - Foreign key to USER_ACCOUNT

**Relationships:**
- Links to CASE.case_id (FK)
- Links to USER_ACCOUNT.user_id (FK)

---

### APPOINTMENT
Scheduled appointments related to cases.

**Columns:**
- `appointment_id` (PK) - Primary key
- `scheduled_start` (date) - Appointment start date/time
- `scheduled_end` (date) - Appointment end date/time
- `location` - Appointment location
- `case_id` (FK) - Foreign key to CASE
- `appointment_client` (FK) - Foreign key to CLIENT
- `appointment_user` (FK) - Foreign key to USER_ACCOUNT

**Relationships:**
- Links to CASE.case_id (FK)
- Links to CLIENT.client_id (FK)
- Links to USER_ACCOUNT.user_id (FK)

---

### MESSAGE
Messages related to cases.

**Columns:**
- `message_id` (PK) - Primary key
- `subject` - Message subject
- `body` - Message body
- `sent_on` (date) - Date message was sent
- `case_id` (FK) - Foreign key to CASE
- `recipient_client_id` (FK) - Foreign key to CLIENT
- `sender_user_id` (FK) - Foreign key to USER_ACCOUNT

**Relationships:**
- Links to CASE.case_id (FK)
- Links to CLIENT.client_id (FK)
- Links to USER_ACCOUNT.user_id (FK)

---

### DOCUMENT
Documents associated with cases.

**Columns:**
- `document_id` (PK) - Primary key
- `file_name` - Name of the file
- `storage_path` - Path where file is stored
- `blob_id` - Binary large object identifier
- `mime_type` - MIME type of the file
- `file_size` - Size of the file
- `uploaded_on` (date) - Date file was uploaded
- `hash_sha256` - SHA256 hash of the file
- `case_id` (FK) - Foreign key to CASE
- `uploader_user_id` (FK) - Foreign key to USER_ACCOUNT
- `doc_type_id` (FK) - Foreign key to DOC_TYPE

**Relationships:**
- Links to CASE.case_id (FK)
- Links to USER_ACCOUNT.user_id (FK)
- Links to DOC_TYPE.doc_type_id (FK)

---

### DOC_TYPE
Lookup table for document types.

**Columns:**
- `doc_type_id` (PK) - Primary key
- `name` - Document type name

**Relationships:**
- Referenced by DOCUMENT.doc_type_id (FK)

---

### CASE_NOTE
Notes associated with cases.

**Columns:**
- `case_note_id` (PK) - Primary key
- `body` - Note content
- `is_internal` (bool) - Whether note is internal only
- `created_on` (date) - Date note was created
- `case_id` (FK) - Foreign key to CASE
- `author_user_id` (FK) - Foreign key to USER_ACCOUNT

**Relationships:**
- Links to CASE.case_id (FK)
- Links to USER_ACCOUNT.user_id (FK)

---

### TASK
Tasks related to cases.

**Columns:**
- `task_id` (PK) - Primary key
- `title` - Task title
- `details` - Task details
- `status` (enum) - Task status
- `due_date` (date) - Due date
- `created_on` (date) - Creation date
- `completed_on` (date) - Completion date
- `case_id` (FK) - Foreign key to CASE
- `assignee_user_id` (FK) - Foreign key to USER_ACCOUNT

**Relationships:**
- Links to CASE.case_id (FK)
- Links to USER_ACCOUNT.user_id (FK)

---

## AUDIT Section (Not Included in MVP)

### AUDIT_LOG
General audit log for tracking changes.

**Columns:**
- `audit_id` (PK) - Primary key
- `entity_name` - Name of the entity changed
- `entity_id` - ID of the entity changed
- `action` (enum) - Action performed (create, update, delete)
- `changed_on` (date) - Date of change
- `diff_json` - JSON representation of changes
- `actor_user_id` (FK) - Foreign key to USER_ACCOUNT

**Relationships:**
- Links to USER_ACCOUNT.user_id (FK)

---

### LOGIN_AUDIT
Audit log specifically for login attempts.

**Columns:**
- `login_audit_id` (PK) - Primary key
- `occurred_on` (date) - Date/time of login attempt
- `ip_address` - IP address of login attempt
- `user_agent` - Browser/client user agent
- `success` (bool) - Whether login was successful
- `user_id` (FK) - Foreign key to USER_ACCOUNT

**Relationships:**
- Links to USER_ACCOUNT.user_id (FK)

---

## Entity Relationship Summary

### One-to-Many Relationships
- CASE_STATUS → CASE (one status can be used by many cases)
- PRACTICE_AREA → CASE (one practice area can have many cases)
- CLIENT → CASE (one client can have many cases)
- CLIENT → ADDRESS (one client can have many addresses)
- USER_ACCOUNT → ADDRESS (one user can have many addresses)
- USER_ACCOUNT → CLIENT (one user account can be linked to one client)
- CASE → CASE_ASSIGNMENT (one case can have many assignments)
- CASE → APPOINTMENT (one case can have many appointments)
- CASE → MESSAGE (one case can have many messages)
- CASE → DOCUMENT (one case can have many documents)
- CASE → CASE_NOTE (one case can have many notes)
- CASE → TASK (one case can have many tasks)
- USER_ACCOUNT → CASE_ASSIGNMENT (one user can have many case assignments)
- USER_ACCOUNT → APPOINTMENT (one user can have many appointments)
- CLIENT → APPOINTMENT (one client can have many appointments)
- USER_ACCOUNT → MESSAGE (one user can send many messages)
- CLIENT → MESSAGE (one client can receive many messages)
- DOC_TYPE → DOCUMENT (one document type can categorize many documents)
- USER_ACCOUNT → DOCUMENT (one user can upload many documents)
- USER_ACCOUNT → CASE_NOTE (one user can author many notes)
- USER_ACCOUNT → TASK (one user can be assigned many tasks)
- USER_ACCOUNT → AUDIT_LOG (one user can have many audit entries)
- USER_ACCOUNT → LOGIN_AUDIT (one user can have many login attempts)

### Many-to-Many Relationships
- USER_ACCOUNT ↔ ROLE (through USER_ROLE junction table)

---

## Notes

1. **MVP Scope**: The SUPPORTING CASE DATA and AUDIT sections are marked as "NOT INCLUDED IN MVP"
2. **Data Types**: 
   - `date` fields store date/datetime values
   - `enum` fields store enumerated values (predefined options)
   - `bool` fields store true/false values
   - `unique` constraint ensures no duplicate values
3. **Foreign Keys**: All FK (Foreign Key) relationships enforce referential integrity
4. **Primary Keys**: All PK (Primary Key) fields uniquely identify records