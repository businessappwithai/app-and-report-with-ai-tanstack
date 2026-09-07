#!/usr/bin/env python3
"""
Seed comprehensive HMS (Hospital Management System) schema metadata
into the enterprise_config database for Mastra NL-to-SQL context.

Populates:
  - ds_schema_cache          : full schema text for LLM context
  - schema_table_instructions : per-table business descriptions + example SQL
  - schema_field_instructions : per-field descriptions & business meanings
  - metadata_entity_header    : entity catalogue for RBAC / UI
  - metadata_entity_field     : field catalogue for RBAC / UI
"""

import os, uuid, json

DS_ID   = "663692ea-4d21-4d01-b00e-56b2eb6aec62"
ADMIN   = "1aa00cc2af0225000c5c114df3eebb69"
NOW     = "2026-06-06 06:00:00"

# ── HMS table definitions ────────────────────────────────────────────────────
# Format: (table_name, description, business_domain, example_queries,
#          llm_instructions, columns)
# Each column: (name, type, nullable, pk, fk_table, fk_col, description,
#               business_meaning, example_values)

HMS_TABLES = [

  # ── PATIENTS ──────────────────────────────────────────────────────────────
  ("bus_patient",
   "Master patient registry. Every person who has received care at the hospital has exactly one record here. Central hub linked to admissions, appointments, lab orders, prescriptions and billing.",
   "Patient Management",
   json.dumps([
     "SELECT p.mrn, p.first_name, p.last_name, p.gender, p.date_of_birth FROM bus_patient p WHERE p.is_active = true ORDER BY p.last_name",
     "SELECT COUNT(*) as total_patients, gender, COUNT(*) FILTER (WHERE is_active) as active FROM bus_patient GROUP BY gender",
     "SELECT p.mrn, p.first_name, p.last_name, EXTRACT(YEAR FROM AGE(p.date_of_birth)) as age FROM bus_patient p WHERE p.is_active = true ORDER BY age DESC LIMIT 10"
   ]),
   "Always join via patient_id when querying admissions, appointments, lab results, or prescriptions. Use mrn for patient identification in user-facing queries. age is calculated as EXTRACT(YEAR FROM AGE(date_of_birth)).",
   [
     ("id",                      "uuid",      False, True,  None,             None,     "Surrogate primary key (UUID).", "Internal identifier. Never display to users; use mrn instead.", None),
     ("mrn",                     "varchar(20)",False, False, None,             None,     "Medical Record Number — the hospital-wide unique patient identifier printed on wristbands.", "Unique across all patients. Format: MRN-YYYYNNNNN. Use for patient lookup.", '["MRN-20240001","MRN-20240002"]'),
     ("first_name",              "varchar(100)",False,False, None,             None,     "Patient legal first name.", "Use with last_name for display. Do not abbreviate.", None),
     ("last_name",               "varchar(100)",False,False, None,             None,     "Patient legal last (family) name.", None, None),
     ("date_of_birth",           "date",      True,  False, None,             None,     "Date of birth. Use with EXTRACT(YEAR FROM AGE(date_of_birth)) to compute current age.", "NEVER store calculated age — always compute from dob.", '["1985-04-12","2001-11-30"]'),
     ("gender",                  "varchar(10)",True, False, None,             None,     "Patient gender as recorded at registration.", "Values: Male, Female, Other, Unknown.", '["Male","Female","Other"]'),
     ("blood_group",             "varchar(5)", True,  False, None,             None,     "ABO blood group with Rh factor.", None, '["A+","B-","O+","AB+"]'),
     ("marital_status",          "varchar(20)",True,  False, None,             None,     "Marital status.", None, '["Single","Married","Divorced","Widowed"]'),
     ("address",                 "text",      True,  False, None,             None,     "Full street address.", None, None),
     ("city",                    "varchar(100)",True, False, None,             None,     "City of residence.", None, None),
     ("state",                   "varchar(100)",True, False, None,             None,     "State / province.", None, None),
     ("phone_primary",           "varchar(20)",True,  False, None,             None,     "Primary contact phone number.", None, None),
     ("email",                   "varchar(255)",True, False, None,             None,     "Patient email address.", None, None),
     ("emergency_contact_name",  "varchar(200)",True, False, None,             None,     "Name of emergency contact person.", None, None),
     ("emergency_contact_phone", "varchar(20)",True,  False, None,             None,     "Phone of emergency contact.", None, None),
     ("emergency_contact_relation","varchar(50)",True,False, None,             None,     "Relationship of emergency contact to patient (e.g., Spouse, Parent, Sibling).", None, '["Spouse","Parent","Child","Sibling"]'),
     ("nationality",             "varchar(100)",True, False, None,             None,     "Patient nationality.", None, None),
     ("occupation",              "varchar(100)",True, False, None,             None,     "Patient occupation.", None, None),
     ("is_active",               "boolean",   False, False, None,             None,     "False if the patient record is archived or merged.", "Filter with WHERE is_active = true unless querying all-time records.", None),
     ("created_at",              "timestamp", False, False, None,             None,     "Record creation timestamp.", None, None),
     ("updated_at",              "timestamp", False, False, None,             None,     "Last update timestamp.", None, None),
   ]),

  # ── DEPARTMENTS ───────────────────────────────────────────────────────────
  ("bus_department",
   "Hospital organisational units (clinical and administrative). Every doctor and ward belongs to a department.",
   "Hospital Administration",
   json.dumps([
     "SELECT department_name, department_type, is_active FROM bus_department ORDER BY department_name",
     "SELECT d.department_name, COUNT(doc.id) as doctor_count FROM bus_department d LEFT JOIN bus_doctor doc ON doc.department_id = d.id GROUP BY d.id, d.department_name",
   ]),
   "department_type distinguishes clinical from support/admin units. Join bus_doctor and bus_ward on department_id.",
   [
     ("id",               "uuid",       False,True,  None,None, "Primary key.", None, None),
     ("department_code",  "varchar(20)", False,False, None,None, "Short alphanumeric code used on forms and reports (e.g., CARD, NEURO, ER).", None, '["CARD","NEUR","ORTH","PEDS","ER","OBG"]'),
     ("department_name",  "varchar(200)",False,False, None,None, "Full department name (e.g., Cardiology, Neurology).", None, '["Cardiology","Neurology","Emergency","Pediatrics","Obstetrics"]'),
     ("department_type",  "varchar(50)", False,False, None,None, "Broad category of the department.", None, '["Clinical","Surgical","Diagnostic","Emergency","Administrative","Support"]'),
     ("floor_number",     "integer",    True, False, None,None, "Floor on which the department is located.", None, None),
     ("phone_extension",  "varchar(20)", True, False, None,None, "Internal phone extension.", None, None),
     ("is_active",        "boolean",    False,False, None,None, "Inactive departments are archived but kept for historical reporting.", None, None),
   ]),

  # ── STAFF / USERS ─────────────────────────────────────────────────────────
  ("bus_user",
   "All hospital staff with system access — doctors, nurses, technicians, administrators, reception. The role column indicates their function.",
   "Human Resources",
   json.dumps([
     "SELECT first_name, last_name, role, is_active FROM bus_user ORDER BY last_name",
     "SELECT role, COUNT(*) as staff_count FROM bus_user WHERE is_active = true GROUP BY role ORDER BY staff_count DESC",
     "SELECT u.first_name, u.last_name, d.department_name FROM bus_user u JOIN bus_department d ON u.department_id = d.id WHERE u.role = 'Nurse' AND u.is_active = true",
   ]),
   "role distinguishes the type of staff member. Doctors appear in both bus_user (HR record) and bus_doctor (clinical details). Join bus_doctor on user_id to get clinical attributes.",
   [
     ("id",            "uuid",       False,True,  None,          None,    "Primary key.", None, None),
     ("employee_id",   "varchar(20)", False,False, None,          None,    "HR employee number. Unique within the hospital.", None, None),
     ("username",      "varchar(100)",False,False, None,          None,    "Login username.", None, None),
     ("email",         "varchar(255)",False,False, None,          None,    "Work email address.", None, None),
     ("first_name",    "varchar(100)",False,False, None,          None,    "Given name.", None, None),
     ("last_name",     "varchar(100)",False,False, None,          None,    "Family name.", None, None),
     ("role",          "varchar(50)", False,False, None,          None,    "Job role within the hospital system.", "Primary classification of the staff member's function.", '["Doctor","Nurse","Head Nurse","Lab Technician","Pharmacist","Reception","Administrator","Radiologist"]'),
     ("department_id", "uuid",       True, False, "bus_department","id",  "Department the user belongs to.", None, None),
     ("phone",         "varchar(20)", True, False, None,          None,    "Contact phone number.", None, None),
     ("is_active",     "boolean",    False,False, None,          None,    "False for terminated or suspended staff.", None, None),
     ("created_at",    "timestamp",  False,False, None,          None,    "Account creation timestamp.", None, None),
   ]),

  # ── DOCTORS ───────────────────────────────────────────────────────────────
  ("bus_doctor",
   "Clinical details for physicians. Each doctor is also a bus_user (joined via user_id). Contains medical specialisation, licence and consultation fee.",
   "Clinical Staff",
   json.dumps([
     "SELECT u.first_name, u.last_name, d.specialization, d.experience_years FROM bus_doctor d JOIN bus_user u ON d.user_id = u.id WHERE d.is_active = true ORDER BY d.specialization",
     "SELECT d.specialization, COUNT(*) as doctor_count FROM bus_doctor d WHERE d.is_active = true GROUP BY d.specialization ORDER BY doctor_count DESC",
     "SELECT u.first_name, u.last_name, COUNT(a.id) as admission_count FROM bus_doctor d JOIN bus_user u ON d.user_id = u.id JOIN bus_admission a ON a.attending_doctor_id = d.id GROUP BY d.id, u.first_name, u.last_name ORDER BY admission_count DESC LIMIT 10",
   ]),
   "Always join bus_user on user_id to get the doctor's name. specialization is the medical specialty (e.g., Cardiology). Department context comes from bus_department via department_id.",
   [
     ("id",               "uuid",       False,True,  None,           None,   "Primary key.", None, None),
     ("user_id",          "uuid",       False,False, "bus_user",     "id",   "Link to the doctor's staff record in bus_user.", None, None),
     ("employee_id",      "varchar(20)", False,False, None,           None,   "HR employee number (same as bus_user.employee_id).", None, None),
     ("specialization",   "varchar(200)",False,False, None,           None,   "Primary medical specialisation.", None, '["Cardiology","Neurology","Orthopedics","Pediatrics","Obstetrics & Gynecology","General Surgery","Emergency Medicine","Radiology","Dermatology","Psychiatry"]'),
     ("sub_specialization","varchar(200)",True,False, None,           None,   "Sub-specialty (optional), e.g., Interventional Cardiology.", None, None),
     ("license_number",   "varchar(100)",False,False, None,           None,   "Medical council licence number.", None, None),
     ("department_id",    "uuid",       False,False, "bus_department","id",   "Primary department.", None, None),
     ("qualification",    "varchar(200)",True, False, None,           None,   "Highest medical qualification (e.g., MD, MBBS, MS, DM).", None, '["MBBS","MD","MS","DM","MCh","FRCS"]'),
     ("experience_years", "integer",    True, False, None,           None,   "Total years of clinical experience.", None, None),
     ("consultation_fee", "decimal(10,2)",True,False, None,          None,   "Standard outpatient consultation fee in local currency.", None, None),
     ("is_available",     "boolean",    False,False, None,           None,   "True when accepting new appointments.", None, None),
     ("is_active",        "boolean",    False,False, None,           None,   "False for doctors who have left the hospital.", None, None),
   ]),

  # ── WARDS ─────────────────────────────────────────────────────────────────
  ("bus_ward",
   "Inpatient ward areas. Each ward has a type (General, ICU, Maternity, etc.), a fixed bed capacity, and a head nurse. Admissions and beds are linked here.",
   "Bed Management",
   json.dumps([
     "SELECT ward_name, ward_type, total_beds, available_beds FROM bus_ward WHERE is_active = true ORDER BY ward_name",
     "SELECT ward_type, SUM(total_beds) as total, SUM(available_beds) as available, SUM(total_beds - available_beds) as occupied FROM bus_ward GROUP BY ward_type",
     "SELECT w.ward_name, COUNT(a.id) as current_patients FROM bus_ward w LEFT JOIN bus_admission a ON a.ward_id = w.id AND a.status = 'Active' GROUP BY w.id, w.ward_name ORDER BY current_patients DESC",
   ]),
   "available_beds is the real-time count updated on admission/discharge. Use (total_beds - available_beds) for occupancy. ward_type is the primary classification.",
   [
     ("id",             "uuid",       False,True,  None,       None,     "Primary key.", None, None),
     ("ward_code",      "varchar(20)", False,False, None,       None,     "Short code used on labels and reports (e.g., ICU-1, GEN-A).", None, '["ICU-1","GEN-A","MAT-B","PEDS","ER"]'),
     ("ward_name",      "varchar(200)",False,False, None,       None,     "Full ward name (e.g., General Ward A, Neonatal ICU).", None, None),
     ("ward_type",      "varchar(50)", False,False, None,       None,     "Clinical classification of the ward.", "Use for filtering by care level.", '["General","ICU","CCU","Neonatal ICU","Emergency","Maternity","Pediatric","Surgical","Isolation","Psychiatric"]'),
     ("floor_number",   "integer",    True, False, None,       None,     "Floor in the hospital building.", None, None),
     ("building",       "varchar(100)",True,False, None,       None,     "Building or wing name.", None, None),
     ("total_beds",     "integer",    False,False, None,       None,     "Total physical bed capacity of the ward.", None, None),
     ("available_beds", "integer",    False,False, None,       None,     "Current number of unoccupied beds. Updated automatically on admission/discharge.", None, None),
     ("head_nurse_id",  "uuid",       True, False, "bus_user", "id",    "The ward's head nurse (from bus_user where role = 'Head Nurse').", None, None),
     ("is_active",      "boolean",    False,False, None,       None,     "Inactive wards are closed for admissions.", None, None),
   ]),

  # ── BEDS ──────────────────────────────────────────────────────────────────
  ("bus_bed",
   "Individual bed records within each ward. Status tracks real-time availability. Each active admission is linked to exactly one bed.",
   "Bed Management",
   json.dumps([
     "SELECT b.bed_number, b.bed_type, b.status, w.ward_name FROM bus_bed b JOIN bus_ward w ON b.ward_id = w.id WHERE b.status = 'Available' ORDER BY w.ward_name, b.bed_number",
     "SELECT status, COUNT(*) as count FROM bus_bed GROUP BY status",
   ]),
   "status values: Available, Occupied, Reserved, Maintenance. Join bus_ward on ward_id for ward context.",
   [
     ("id",          "uuid",      False,True,  None,      None,  "Primary key.", None, None),
     ("ward_id",     "uuid",      False,False, "bus_ward","id",  "Ward this bed belongs to.", None, None),
     ("bed_number",  "varchar(20)",False,False, None,      None,  "Human-readable bed label (e.g., 101A, ICU-03).", None, None),
     ("bed_type",    "varchar(50)",False,False, None,      None,  "Specialised type of bed.", None, '["Standard","ICU","HDU","Pediatric","Bariatric","Neonatal"]'),
     ("status",      "varchar(20)",False,False, None,      None,  "Real-time availability status.", "Occupied means there is an active admission in this bed.", '["Available","Occupied","Reserved","Maintenance","Cleaning"]'),
     ("is_active",   "boolean",   False,False, None,      None,  "False for decommissioned beds.", None, None),
   ]),

  # ── APPOINTMENTS ──────────────────────────────────────────────────────────
  ("bus_appointment",
   "Outpatient and scheduled appointments for patients to see a doctor. Covers new, follow-up, emergency and teleconsultation visits.",
   "Outpatient Services",
   json.dumps([
     "SELECT p.first_name, p.last_name, u.first_name as doctor_first, u.last_name as doctor_last, a.appointment_date, a.appointment_time, a.status FROM bus_appointment a JOIN bus_patient p ON a.patient_id = p.id JOIN bus_doctor d ON a.doctor_id = d.id JOIN bus_user u ON d.user_id = u.id WHERE a.appointment_date = CURRENT_DATE ORDER BY a.appointment_time",
     "SELECT status, COUNT(*) as count FROM bus_appointment WHERE appointment_date >= CURRENT_DATE - INTERVAL '30 days' GROUP BY status",
     "SELECT appointment_type, COUNT(*) as count FROM bus_appointment GROUP BY appointment_type ORDER BY count DESC",
   ]),
   "Appointments are OPD (outpatient) visits; inpatient stays are in bus_admission. status = Scheduled means future; Completed means the visit happened.",
   [
     ("id",               "uuid",      False,True,  None,           None,   "Primary key.", None, None),
     ("patient_id",       "uuid",      False,False, "bus_patient",  "id",   "Patient who has the appointment.", None, None),
     ("doctor_id",        "uuid",      False,False, "bus_doctor",   "id",   "Doctor the patient is seeing.", None, None),
     ("department_id",    "uuid",      True, False, "bus_department","id",  "Department hosting the appointment.", None, None),
     ("appointment_date", "date",      False,False, None,           None,   "Scheduled date.", None, None),
     ("appointment_time", "time",      False,False, None,           None,   "Scheduled start time.", None, None),
     ("appointment_type", "varchar(50)",False,False, None,          None,   "Nature of the visit.", None, '["New","Follow-up","Emergency","Teleconsultation","Pre-operative","Post-operative"]'),
     ("status",           "varchar(30)",False,False, None,          None,   "Current lifecycle status of the appointment.", None, '["Scheduled","Confirmed","Checked-In","In-Progress","Completed","Cancelled","No-Show","Rescheduled"]'),
     ("chief_complaint",  "text",      True, False, None,           None,   "Reason for the visit in the patient's own words.", None, None),
     ("notes",            "text",      True, False, None,           None,   "Clinical notes added after the consultation.", None, None),
     ("created_at",       "timestamp", False,False, None,           None,   "Record creation timestamp.", None, None),
   ]),

  # ── ADMISSIONS ────────────────────────────────────────────────────────────
  ("bus_admission",
   "Inpatient admission episodes. Tracks the full journey from admission to discharge: ward, bed, attending doctor, type, diagnosis and insurance. The central fact table for inpatient analytics.",
   "Inpatient Services",
   json.dumps([
     "SELECT a.admission_number, p.mrn, p.first_name, p.last_name, w.ward_name, a.admission_date, a.status FROM bus_admission a JOIN bus_patient p ON a.patient_id = p.id JOIN bus_ward w ON a.ward_id = w.id WHERE a.status = 'Active' ORDER BY a.admission_date DESC",
     "SELECT admission_type, COUNT(*) as admissions, AVG(EXTRACT(DAY FROM (COALESCE(discharge_date, NOW()) - admission_date))) as avg_los_days FROM bus_admission WHERE admission_date >= NOW() - INTERVAL '90 days' GROUP BY admission_type",
     "SELECT w.ward_name, COUNT(a.id) as total_admissions, COUNT(CASE WHEN a.status='Active' THEN 1 END) as current FROM bus_ward w JOIN bus_admission a ON a.ward_id = w.id GROUP BY w.id, w.ward_name ORDER BY total_admissions DESC",
     "SELECT EXTRACT(MONTH FROM admission_date) as month, COUNT(*) as admissions FROM bus_admission WHERE EXTRACT(YEAR FROM admission_date) = EXTRACT(YEAR FROM CURRENT_DATE) GROUP BY month ORDER BY month",
   ]),
   "Length-of-stay (LOS) = discharge_date - admission_date (or NOW() for active admissions). status = Active means the patient is currently admitted. admission_type = Emergency for A&E admissions. admission_number is the human-readable reference.",
   [
     ("id",                   "uuid",      False,True,  None,          None,   "Primary key.", None, None),
     ("admission_number",     "varchar(30)",False,False, None,         None,   "Human-readable admission reference (e.g., ADM-2024-00123). Unique.", None, None),
     ("patient_id",           "uuid",      False,False, "bus_patient", "id",   "Patient being admitted.", None, None),
     ("ward_id",              "uuid",      False,False, "bus_ward",    "id",   "Ward the patient is admitted to.", None, None),
     ("bed_id",               "uuid",      True, False, "bus_bed",     "id",   "Specific bed assigned.", None, None),
     ("admitting_doctor_id",  "uuid",      False,False, "bus_doctor",  "id",   "Doctor who authorised the admission.", None, None),
     ("attending_doctor_id",  "uuid",      True, False, "bus_doctor",  "id",   "Primary treating doctor (may differ from admitting doctor).", None, None),
     ("admission_date",       "timestamp", False,False, None,          None,   "Date and time the patient was admitted.", None, None),
     ("discharge_date",       "timestamp", True, False, None,          None,   "Date and time of discharge. NULL for active admissions.", "NULL means patient is still admitted.", None),
     ("admission_type",       "varchar(50)",False,False, None,         None,   "How the admission was initiated.", None, '["Emergency","Elective","Transfer","Referral","Maternity","Day Surgery"]'),
     ("status",               "varchar(30)",False,False, None,         None,   "Current admission state.", None, '["Active","Discharged","Transferred","LAMA","Absconded","Deceased"]'),
     ("chief_complaint",      "text",      True, False, None,          None,   "Presenting complaint on admission.", None, None),
     ("preliminary_diagnosis","text",      True, False, None,          None,   "Initial clinical assessment on arrival.", None, None),
     ("insurance_id",         "uuid",      True, False, "bus_insurance","id",  "Insurance policy used for this admission (if applicable).", None, None),
     ("created_at",           "timestamp", False,False, None,          None,   "Record creation timestamp.", None, None),
   ]),

  # ── VITAL SIGNS ───────────────────────────────────────────────────────────
  ("bus_vital_sign",
   "Timestamped observations of patient physiological parameters: temperature, blood pressure, pulse, SpO2, weight etc. Multiple readings per patient per admission.",
   "Clinical Monitoring",
   json.dumps([
     "SELECT vs.recorded_at, vs.temperature_celsius, vs.blood_pressure_systolic, vs.blood_pressure_diastolic, vs.heart_rate, vs.oxygen_saturation FROM bus_vital_sign vs JOIN bus_admission a ON vs.admission_id = a.id WHERE a.admission_number = 'ADM-2024-00001' ORDER BY vs.recorded_at",
     "SELECT p.mrn, p.first_name, p.last_name, AVG(vs.heart_rate) as avg_hr, AVG(vs.oxygen_saturation) as avg_spo2 FROM bus_vital_sign vs JOIN bus_patient p ON vs.patient_id = p.id WHERE vs.recorded_at >= NOW() - INTERVAL '24 hours' GROUP BY p.id, p.mrn, p.first_name, p.last_name",
     "SELECT vs.recorded_at, vs.blood_pressure_systolic || '/' || vs.blood_pressure_diastolic as bp FROM bus_vital_sign vs WHERE vs.patient_id = 'patient-uuid-here' ORDER BY vs.recorded_at DESC LIMIT 20",
   ]),
   "blood_pressure is stored as two separate fields: blood_pressure_systolic and blood_pressure_diastolic. Combine as systolic||'/'||diastolic for display. oxygen_saturation is SpO2 (%). pain_scale is 0-10 (0=no pain, 10=worst pain).",
   [
     ("id",                       "uuid",          False,True, None,          None,  "Primary key.", None, None),
     ("patient_id",               "uuid",          False,False,"bus_patient", "id",  "Patient these vitals belong to.", None, None),
     ("admission_id",             "uuid",          True, False,"bus_admission","id", "Admission episode (null for outpatient vitals).", None, None),
     ("recorded_at",              "timestamp",     False,False, None,         None,  "Date and time the observation was recorded.", None, None),
     ("recorded_by",              "uuid",          False,False,"bus_user",    "id",  "Staff member (nurse/doctor) who recorded the vitals.", None, None),
     ("temperature_celsius",      "decimal(4,1)",  True, False, None,         None,  "Body temperature in Celsius. Normal range: 36.1–37.2°C.", "Fever threshold: >38°C. Hypothermia: <35°C.", '["36.6","37.1","38.4","39.2"]'),
     ("blood_pressure_systolic",  "integer",       True, False, None,         None,  "Systolic blood pressure in mmHg (upper number).", "Normal: 90-120 mmHg. Hypertensive crisis: >180 mmHg.", '["120","115","145","180"]'),
     ("blood_pressure_diastolic", "integer",       True, False, None,         None,  "Diastolic blood pressure in mmHg (lower number).", "Normal: 60-80 mmHg.", '["80","75","95","110"]'),
     ("heart_rate",               "integer",       True, False, None,         None,  "Heart rate in beats per minute (BPM).", "Normal adult: 60-100 BPM. Tachycardia: >100 BPM. Bradycardia: <60 BPM.", '["72","88","105","55"]'),
     ("respiratory_rate",         "integer",       True, False, None,         None,  "Respiratory rate in breaths per minute.", "Normal: 12-20 breaths/min.", '["16","18","24","10"]'),
     ("oxygen_saturation",        "decimal(4,1)",  True, False, None,         None,  "Peripheral oxygen saturation (SpO2) as a percentage.", "Normal: 95-100%. Below 90% is a medical emergency.", '["98","97","92","88"]'),
     ("weight_kg",                "decimal(5,2)",  True, False, None,         None,  "Body weight in kilograms.", None, None),
     ("height_cm",                "decimal(5,1)",  True, False, None,         None,  "Height in centimetres.", None, None),
     ("bmi",                      "decimal(4,1)",  True, False, None,         None,  "Body Mass Index = weight_kg / (height_cm/100)². Computed field.", "Underweight:<18.5, Normal:18.5-24.9, Overweight:25-29.9, Obese:>=30", None),
     ("pain_scale",               "integer",       True, False, None,         None,  "Patient-reported pain intensity on a 0-10 scale.", "0 = no pain; 10 = worst imaginable pain.", '["0","3","7","10"]'),
     ("consciousness_level",      "varchar(20)",   True, False, None,         None,  "AVPU scale: Alert, Voice, Pain, Unresponsive.", None, '["Alert","Voice","Pain","Unresponsive"]'),
     ("notes",                    "text",          True, False, None,         None,  "Free-text clinical observations.", None, None),
   ]),

  # ── DIAGNOSES ─────────────────────────────────────────────────────────────
  ("bus_diagnosis",
   "Clinical diagnoses recorded against an admission or outpatient visit. Uses ICD-10 coding. A single admission can have multiple diagnoses (primary + secondary).",
   "Clinical Records",
   json.dumps([
     "SELECT d.icd10_code, d.icd10_description, COUNT(*) as frequency FROM bus_diagnosis d GROUP BY d.icd10_code, d.icd10_description ORDER BY frequency DESC LIMIT 20",
     "SELECT d.icd10_description, d.diagnosis_type, u.first_name, u.last_name FROM bus_diagnosis d JOIN bus_admission a ON d.admission_id = a.id JOIN bus_doctor doc ON d.diagnosed_by = doc.id JOIN bus_user u ON doc.user_id = u.id WHERE a.admission_number = 'ADM-2024-00001'",
     "SELECT icd10_code, icd10_description, COUNT(*) as cases FROM bus_diagnosis WHERE diagnosis_type = 'Primary' AND EXTRACT(YEAR FROM diagnosed_at) = 2024 GROUP BY icd10_code, icd10_description ORDER BY cases DESC LIMIT 10",
   ]),
   "diagnosis_type = Primary is the main diagnosis; Secondary are co-morbidities. icd10_code is the standard ICD-10 code (e.g., J18.9 = Pneumonia unspecified). Always filter by diagnosis_type = 'Primary' when counting admission diagnoses.",
   [
     ("id",               "uuid",      False,True, None,          None,  "Primary key.", None, None),
     ("admission_id",     "uuid",      True, False,"bus_admission","id", "Admission episode this diagnosis belongs to.", None, None),
     ("patient_id",       "uuid",      False,False,"bus_patient", "id",  "Patient this diagnosis is for.", None, None),
     ("icd10_code",       "varchar(20)",False,False,None,         None,  "ICD-10-CM diagnosis code (e.g., I21.0, J18.9, K35.2).", "Always store the official ICD-10 code for analytics and billing.", '["I21.0","J18.9","K35.2","E11.9","C34.1"]'),
     ("icd10_description","varchar(500)",False,False,None,        None,  "Plain-English description of the ICD-10 code.", None, '["Acute myocardial infarction","Community-acquired pneumonia","Type 2 diabetes mellitus"]'),
     ("diagnosis_type",   "varchar(30)",False,False,None,         None,  "Role of this diagnosis in the admission.", None, '["Primary","Secondary","Comorbidity","Complication","Discharge"]'),
     ("diagnosis_status", "varchar(30)",False,False,None,         None,  "Certainty of the diagnosis.", None, '["Provisional","Confirmed","Differential","Ruled-Out","Working"]'),
     ("diagnosed_by",     "uuid",      False,False,"bus_doctor",  "id",  "Doctor who made the diagnosis.", None, None),
     ("diagnosed_at",     "timestamp", False,False,None,         None,  "Timestamp when the diagnosis was recorded.", None, None),
     ("notes",            "text",      True, False,None,         None,  "Additional clinical notes.", None, None),
   ]),

  # ── PRESCRIPTIONS ─────────────────────────────────────────────────────────
  ("bus_prescription",
   "Medication orders written by doctors for inpatient and outpatient care. Tracks drug name, dosage, frequency, route and dispensing status.",
   "Pharmacy",
   json.dumps([
     "SELECT drug_name, COUNT(*) as prescriptions FROM bus_prescription GROUP BY drug_name ORDER BY prescriptions DESC LIMIT 20",
     "SELECT p.mrn, pr.drug_name, pr.dosage, pr.frequency, pr.route, pr.status FROM bus_prescription pr JOIN bus_patient p ON pr.patient_id = p.id WHERE pr.status = 'Active' ORDER BY pr.prescribed_at DESC",
     "SELECT drug_name, AVG(duration_days) as avg_duration FROM bus_prescription WHERE status = 'Completed' GROUP BY drug_name ORDER BY avg_duration DESC",
   ]),
   "frequency values: OD=once daily, BID=twice daily, TID=three times daily, QID=four times daily, PRN=as needed. route values: PO=oral, IV=intravenous, IM=intramuscular, SC=subcutaneous, TOP=topical, INH=inhaled.",
   [
     ("id",             "uuid",       False,True, None,          None,  "Primary key.", None, None),
     ("admission_id",   "uuid",       True, False,"bus_admission","id", "Inpatient admission this prescription is for (null for outpatient).", None, None),
     ("patient_id",     "uuid",       False,False,"bus_patient", "id",  "Patient the medication is prescribed to.", None, None),
     ("prescribed_by",  "uuid",       False,False,"bus_doctor",  "id",  "Doctor who wrote the prescription.", None, None),
     ("prescribed_at",  "timestamp",  False,False,None,          None,  "Date and time the prescription was written.", None, None),
     ("drug_name",      "varchar(300)",False,False,None,         None,  "Generic or brand name of the medication.", None, '["Amoxicillin","Metformin","Paracetamol","Omeprazole","Atorvastatin","Insulin Glargine"]'),
     ("drug_code",      "varchar(50)", True, False,None,         None,  "Hospital formulary or ATC drug code.", None, None),
     ("dosage",         "varchar(100)",False,False,None,         None,  "Amount per dose (e.g., 500mg, 10 units, 1 tablet).", None, '["500mg","250mg","10 units","2 tablets"]'),
     ("frequency",      "varchar(50)", False,False,None,         None,  "Dosing frequency abbreviation.", None, '["OD","BID","TID","QID","Q6H","Q8H","PRN","STAT","QHS"]'),
     ("route",          "varchar(50)", False,False,None,         None,  "Route of administration.", None, '["PO","IV","IM","SC","TOP","INH","SL","PR","NG"]'),
     ("duration_days",  "integer",    True, False,None,          None,  "Prescribed duration in days (null for ongoing/PRN).", None, None),
     ("start_date",     "date",       False,False,None,          None,  "Date the medication course begins.", None, None),
     ("end_date",       "date",       True, False,None,          None,  "Date the medication course ends (null if open-ended).", None, None),
     ("status",         "varchar(30)", False,False,None,         None,  "Current state of the prescription.", None, '["Active","Completed","Discontinued","On-Hold","Dispensed"]'),
     ("instructions",   "text",       True, False,None,          None,  "Special dispensing or administration instructions.", None, None),
     ("is_prn",         "boolean",    False,False,None,          None,  "True if the medication is PRN (take as needed rather than on a schedule).", None, None),
   ]),

  # ── LAB ORDERS ────────────────────────────────────────────────────────────
  ("bus_lab_order",
   "Laboratory and radiology test requests ordered by doctors. Each order results in one or more results in bus_lab_result.",
   "Laboratory",
   json.dumps([
     "SELECT test_name, COUNT(*) as orders, COUNT(CASE WHEN status='Resulted' THEN 1 END) as resulted FROM bus_lab_order GROUP BY test_name ORDER BY orders DESC LIMIT 20",
     "SELECT lo.order_number, lo.test_name, lo.priority, lo.status, lo.ordered_at FROM bus_lab_order lo JOIN bus_patient p ON lo.patient_id = p.id WHERE p.mrn = 'MRN-20240001' ORDER BY lo.ordered_at DESC",
     "SELECT priority, AVG(EXTRACT(EPOCH FROM (resulted_at - ordered_at))/3600) as avg_turnaround_hours FROM bus_lab_order lo JOIN bus_lab_result lr ON lr.order_id = lo.id WHERE lo.status = 'Resulted' GROUP BY priority",
   ]),
   "priority = STAT means critical/immediate. status = Resulted means the report is available in bus_lab_result. Turnaround time = resulted_at - ordered_at.",
   [
     ("id",           "uuid",      False,True, None,          None,  "Primary key.", None, None),
     ("order_number", "varchar(30)",False,False,None,         None,  "Unique lab order reference number.", None, None),
     ("patient_id",   "uuid",      False,False,"bus_patient", "id",  "Patient the test was ordered for.", None, None),
     ("admission_id", "uuid",      True, False,"bus_admission","id", "Admission (inpatient) or null for outpatient.", None, None),
     ("ordered_by",   "uuid",      False,False,"bus_doctor",  "id",  "Doctor who ordered the test.", None, None),
     ("ordered_at",   "timestamp", False,False,None,          None,  "Date and time the order was placed.", None, None),
     ("test_name",    "varchar(300)",False,False,None,        None,  "Full name of the test (e.g., Complete Blood Count, Chest X-Ray, HbA1c).", None, '["Complete Blood Count","Basic Metabolic Panel","HbA1c","Lipid Panel","Chest X-Ray","ECG"]'),
     ("test_code",    "varchar(50)",True, False,None,         None,  "LOINC or hospital lab code for the test.", None, None),
     ("test_category","varchar(100)",False,False,None,        None,  "Broad category of the test.", None, '["Hematology","Biochemistry","Microbiology","Radiology","Pathology","Cardiology","Immunology"]'),
     ("priority",     "varchar(20)",False,False,None,         None,  "Urgency of the test request.", None, '["Routine","Urgent","STAT"]'),
     ("status",       "varchar(30)",False,False,None,         None,  "Current processing state.", None, '["Ordered","Sample Collected","Processing","Resulted","Cancelled","On-Hold"]'),
     ("sample_type",  "varchar(50)",True, False,None,         None,  "Type of biological sample required.", None, '["Whole Blood","Serum","Plasma","Urine","Stool","CSF","Swab","Tissue","Sputum"]'),
     ("collected_at", "timestamp",  True, False,None,         None,  "Timestamp of sample collection.", None, None),
   ]),

  # ── LAB RESULTS ───────────────────────────────────────────────────────────
  ("bus_lab_result",
   "Test result values and interpretations corresponding to lab orders. May contain multiple parameters per order (e.g., CBC has Hb, WBC, Platelets etc. as separate rows).",
   "Laboratory",
   json.dumps([
     "SELECT lo.test_name, lr.result_value, lr.unit, lr.reference_range_low, lr.reference_range_high, lr.result_flag, lr.resulted_at FROM bus_lab_result lr JOIN bus_lab_order lo ON lr.order_id = lo.id WHERE lo.order_number = 'LAB-2024-00001' ORDER BY lr.test_name",
     "SELECT lr.test_name, COUNT(CASE WHEN lr.result_flag IN ('High','Critical-High') THEN 1 END) as high_count, COUNT(CASE WHEN lr.result_flag IN ('Low','Critical-Low') THEN 1 END) as low_count FROM bus_lab_result lr GROUP BY lr.test_name ORDER BY high_count DESC LIMIT 20",
   ]),
   "result_flag indicates clinical significance. Critical-High and Critical-Low require immediate notification. result_value is stored as varchar to accommodate text results. Numeric comparisons may require CAST(result_value AS NUMERIC).",
   [
     ("id",                 "uuid",      False,True, None,          None,  "Primary key.", None, None),
     ("order_id",           "uuid",      False,False,"bus_lab_order","id", "The lab order this result belongs to.", None, None),
     ("patient_id",         "uuid",      False,False,"bus_patient", "id",  "Patient (denormalized for fast queries).", None, None),
     ("test_name",          "varchar(300)",False,False,None,        None,  "Name of the specific test parameter (e.g., Haemoglobin, Sodium, WBC).", None, None),
     ("result_value",       "varchar(200)",False,False,None,        None,  "The measured result. Stored as text to support numeric, qualitative and narrative results.", None, None),
     ("unit",               "varchar(50)",True, False,None,         None,  "Unit of measurement (e.g., g/dL, mmol/L, cells/μL).", None, None),
     ("reference_range_low","varchar(50)",True, False,None,         None,  "Lower bound of the normal reference range.", None, None),
     ("reference_range_high","varchar(50)",True,False,None,         None,  "Upper bound of the normal reference range.", None, None),
     ("result_flag",        "varchar(30)",True, False,None,         None,  "Clinical interpretation of the result.", "Critical values require urgent action.", '["Normal","High","Low","Critical-High","Critical-Low","Abnormal","Positive","Negative","Inconclusive"]'),
     ("resulted_at",        "timestamp", False,False,None,          None,  "Timestamp when the result was verified and released.", None, None),
     ("resulted_by",        "uuid",      False,False,"bus_user",    "id",  "Lab technician or pathologist who verified the result.", None, None),
     ("notes",              "text",      True, False,None,          None,  "Interpretive comments or free-text findings.", None, None),
   ]),

  # ── INVOICES ──────────────────────────────────────────────────────────────
  ("bus_invoice",
   "Patient billing invoices. Each admission or outpatient visit generates one invoice. Line items are in bus_invoice_item. Tracks payment status and method.",
   "Revenue & Billing",
   json.dumps([
     "SELECT i.invoice_number, p.mrn, p.first_name, p.last_name, i.total_amount, i.paid_amount, i.balance_amount, i.status FROM bus_invoice i JOIN bus_patient p ON i.patient_id = p.id WHERE i.status = 'Pending' ORDER BY i.invoice_date DESC",
     "SELECT invoice_type, SUM(total_amount) as revenue, SUM(paid_amount) as collected, COUNT(*) as invoice_count FROM bus_invoice WHERE invoice_date >= CURRENT_DATE - INTERVAL '30 days' GROUP BY invoice_type",
     "SELECT payment_method, COUNT(*) as transactions, SUM(paid_amount) as total_collected FROM bus_invoice WHERE status IN ('Paid','Partially-Paid') GROUP BY payment_method",
   ]),
   "balance_amount = total_amount - paid_amount. status = Paid means fully settled. A balance_amount > 0 with status = Partially-Paid indicates outstanding dues. invoice_type = Inpatient for admissions.",
   [
     ("id",              "uuid",         False,True, None,          None,  "Primary key.", None, None),
     ("invoice_number",  "varchar(30)",  False,False,None,          None,  "Unique invoice reference.", None, None),
     ("patient_id",      "uuid",         False,False,"bus_patient", "id",  "Patient who is billed.", None, None),
     ("admission_id",    "uuid",         True, False,"bus_admission","id", "Linked admission (null for outpatient/OPD invoices).", None, None),
     ("invoice_date",    "date",         False,False,None,          None,  "Date the invoice was generated.", None, None),
     ("invoice_type",    "varchar(50)",  False,False,None,          None,  "Category of services billed.", None, '["Inpatient","Outpatient","Emergency","Pharmacy","Laboratory","Radiology","Day Surgery"]'),
     ("subtotal",        "decimal(12,2)",False,False,None,          None,  "Sum of all line items before tax and discount.", None, None),
     ("tax_amount",      "decimal(12,2)",False,False,None,          None,  "Applicable tax (GST/VAT etc.).", None, None),
     ("discount_amount", "decimal(12,2)",False,False,None,          None,  "Total discount applied.", None, None),
     ("total_amount",    "decimal(12,2)",False,False,None,          None,  "Final invoiced amount = subtotal + tax - discount.", None, None),
     ("paid_amount",     "decimal(12,2)",False,False,None,          None,  "Amount paid so far.", None, None),
     ("balance_amount",  "decimal(12,2)",False,False,None,          None,  "Outstanding balance = total_amount - paid_amount.", None, None),
     ("status",          "varchar(30)",  False,False,None,          None,  "Payment status.", None, '["Draft","Pending","Partially-Paid","Paid","Overdue","Cancelled","Refunded","Written-Off"]'),
     ("payment_method",  "varchar(50)",  True, False,None,          None,  "Method used for the most recent payment.", None, '["Cash","Credit Card","Debit Card","Insurance","Bank Transfer","Cheque","Online Payment","Waiver"]'),
     ("insurance_id",    "uuid",         True, False,"bus_insurance","id", "Insurance policy used to pay part of this invoice.", None, None),
     ("created_at",      "timestamp",    False,False,None,          None,  "Invoice creation timestamp.", None, None),
   ]),

  # ── INVOICE ITEMS ─────────────────────────────────────────────────────────
  ("bus_invoice_item",
   "Individual line items on a patient invoice. Each service, medication, procedure, room charge or investigation is one row.",
   "Revenue & Billing",
   json.dumps([
     "SELECT ii.service_name, ii.service_category, ii.quantity, ii.unit_price, ii.total_price FROM bus_invoice_item ii JOIN bus_invoice i ON ii.invoice_id = i.id WHERE i.invoice_number = 'INV-2024-00001' ORDER BY ii.service_category",
     "SELECT service_category, SUM(total_price) as revenue FROM bus_invoice_item GROUP BY service_category ORDER BY revenue DESC",
   ]),
   "service_category groups items into: Room & Board, Nursing, Consultation, Procedure, Medication, Lab, Radiology, Misc.",
   [
     ("id",               "uuid",         False,True, None,        None,  "Primary key.", None, None),
     ("invoice_id",       "uuid",         False,False,"bus_invoice","id", "Parent invoice.", None, None),
     ("service_code",     "varchar(50)",  True, False,None,        None,  "Hospital billing code for the service.", None, None),
     ("service_name",     "varchar(300)", False,False,None,        None,  "Description of the service or item billed.", None, None),
     ("service_category", "varchar(100)", False,False,None,        None,  "Billing category.", None, '["Consultation","Room & Board","Nursing Care","Procedure","Medication","Laboratory","Radiology","Physiotherapy","Miscellaneous"]'),
     ("quantity",         "decimal(8,2)", False,False,None,        None,  "Number of units (e.g., 3 days room charge, 2 tablets).", None, None),
     ("unit_price",       "decimal(12,2)",False,False,None,        None,  "Price per unit.", None, None),
     ("discount_percent", "decimal(5,2)", False,False,None,        None,  "Discount applied as a percentage.", None, None),
     ("total_price",      "decimal(12,2)",False,False,None,        None,  "Final line total = quantity × unit_price × (1 - discount_percent/100).", None, None),
   ]),

  # ── INSURANCE ─────────────────────────────────────────────────────────────
  ("bus_insurance",
   "Health insurance policies held by patients. A patient may have multiple policies (primary and secondary). Links to admissions and invoices for claim processing.",
   "Insurance",
   json.dumps([
     "SELECT provider_name, COUNT(*) as policies, COUNT(CASE WHEN is_active THEN 1 END) as active FROM bus_insurance GROUP BY provider_name ORDER BY active DESC",
     "SELECT p.mrn, p.first_name, p.last_name, i.provider_name, i.policy_number, i.valid_to FROM bus_insurance i JOIN bus_patient p ON i.patient_id = p.id WHERE i.is_active = true AND i.valid_to < CURRENT_DATE + INTERVAL '30 days' ORDER BY i.valid_to",
   ]),
   "coverage_percentage is the insurer's share of the bill (e.g., 80 means insurer pays 80%, patient pays 20%). is_primary = true for the main policy when a patient has multiple policies. Check valid_from and valid_to for policy validity at admission date.",
   [
     ("id",                  "uuid",         False,True, None,         None,  "Primary key.", None, None),
     ("patient_id",          "uuid",         False,False,"bus_patient","id",  "Patient who holds this policy.", None, None),
     ("provider_name",       "varchar(200)", False,False,None,         None,  "Name of the insurance company.", None, None),
     ("provider_code",       "varchar(50)",  True, False,None,         None,  "Short insurer code used in claims processing.", None, None),
     ("policy_number",       "varchar(100)", False,False,None,         None,  "Insurance policy number as on the card.", None, None),
     ("group_number",        "varchar(100)", True, False,None,         None,  "Group or employer policy number (for group plans).", None, None),
     ("member_id",           "varchar(100)", True, False,None,         None,  "Member/beneficiary ID on the insurance card.", None, None),
     ("coverage_type",       "varchar(50)",  False,False,None,         None,  "Type of coverage.", None, '["Individual","Family","Corporate Group","Senior Citizen","Government"]'),
     ("plan_name",           "varchar(200)", True, False,None,         None,  "Name of the specific insurance plan.", None, None),
     ("copay_amount",        "decimal(10,2)",True, False,None,         None,  "Fixed co-payment amount the patient pays per visit.", None, None),
     ("deductible_amount",   "decimal(10,2)",True, False,None,         None,  "Annual deductible the patient must pay before insurance covers.", None, None),
     ("coverage_percentage", "decimal(5,2)", False,False,None,         None,  "Percentage of the bill paid by the insurer (e.g., 80.00 = 80%).", None, None),
     ("valid_from",          "date",         False,False,None,         None,  "Policy start date.", None, None),
     ("valid_to",            "date",         False,False,None,         None,  "Policy expiry date.", None, None),
     ("is_primary",          "boolean",      False,False,None,         None,  "True if this is the patient's primary insurance (used first for billing).", None, None),
     ("is_active",           "boolean",      False,False,None,         None,  "False if the policy has expired or been cancelled.", None, None),
   ]),

]  # END HMS_TABLES


def esc(s):
    """Escape single quotes for SQL."""
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

def bool_val(v):
    return "1" if v else "0"

lines = []
lines.append("SET NAMES utf8mb4;")
lines.append(f"-- HMS metadata seed for data_source_id={DS_ID}")
lines.append("")

# ── 1. ds_schema_cache ────────────────────────────────────────────────────
schema_parts = ["=== HMS (Hospital Management System) DATABASE SCHEMA ===\n"]
schema_metadata_tables = []

for (tname, tdesc, tdomain, texample, tllm, cols) in HMS_TABLES:
    schema_parts.append(f"TABLE: {tname}")
    schema_parts.append(f"Description: {tdesc}")
    schema_parts.append("Columns:")
    for (cn, ct, nullable, pk, fkt, fkc, cdesc, bm, _ev) in cols:
        constraints = []
        if pk:       constraints.append("PRIMARY KEY")
        if not nullable: constraints.append("NOT NULL")
        cstr = f" [{', '.join(constraints)}]" if constraints else ""
        line = f"  - {cn}: {ct}{cstr}"
        if cdesc: line += f"  -- {cdesc}"
        schema_parts.append(line)
        if fkt:
            schema_parts.append(f"    FK -> {fkt}({fkc})")
    schema_parts.append("")

    # Build schema_metadata tables array
    col_defs = []
    pk_cols = []
    fk_defs = []
    for (cn, ct, nullable, pk, fkt, fkc, _cd, _bm, _ev) in cols:
        col_defs.append({"name": cn, "type": ct, "nullable": nullable, "isPrimaryKey": pk})
        if pk: pk_cols.append(cn)
        if fkt: fk_defs.append({"column": cn, "referencedTable": fkt, "referencedColumn": fkc})
    schema_metadata_tables.append({"name": tname, "columns": col_defs, "primaryKey": pk_cols, "foreignKeys": fk_defs})

embedding_data = "\n".join(schema_parts)
schema_metadata = json.dumps({"tables": schema_metadata_tables, "views": []})
cache_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"schema_cache_{DS_ID}"))

lines.append("-- ds_schema_cache")
lines.append(f"""INSERT INTO ds_schema_cache (id, data_source_id, schema_metadata, embedding_data, last_introspected_at, created_at, updated_at)
VALUES ({esc(cache_id)}, {esc(DS_ID)}, {esc(schema_metadata)}, {esc(embedding_data)}, {esc(NOW)}, {esc(NOW)}, {esc(NOW)})
ON DUPLICATE KEY UPDATE schema_metadata=VALUES(schema_metadata), embedding_data=VALUES(embedding_data), updated_at=VALUES(updated_at);""")
lines.append("")

# ── 2. schema_table_instructions ─────────────────────────────────────────
lines.append("-- schema_table_instructions")
for (tname, tdesc, tdomain, texample, tllm, _cols) in HMS_TABLES:
    tid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"sti_{DS_ID}_{tname}"))
    lines.append(f"""INSERT INTO schema_table_instructions
  (id, data_source_id, table_name, description, llm_instructions, example_queries, business_domain, created_at, updated_at, created_by, updated_by)
VALUES
  ({esc(tid)}, {esc(DS_ID)}, {esc(tname)}, {esc(tdesc)}, {esc(tllm)}, {esc(texample)}, {esc(tdomain)}, {esc(NOW)}, {esc(NOW)}, {esc(ADMIN)}, {esc(ADMIN)})
ON DUPLICATE KEY UPDATE description=VALUES(description), llm_instructions=VALUES(llm_instructions), example_queries=VALUES(example_queries), updated_at=VALUES(updated_at);""")
lines.append("")

# ── 3. schema_field_instructions + metadata_entity_header/field ──────────
lines.append("-- schema_field_instructions + metadata_entity_header/field")
for (tname, tdesc, tdomain, _ex, _llm, cols) in HMS_TABLES:
    hdr_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"meh_{DS_ID}_{tname}"))
    schema_meta = json.dumps({"name": tname, "columns": [{"name": c[0], "type": c[1]} for c in cols]})

    # metadata_entity_header
    lines.append(f"""INSERT INTO metadata_entity_header
  (id, data_source_id, entity_name, entity_schema, entity_type, schema_metadata, description, is_active, is_hidden, created_by, created_at, updated_at)
VALUES
  ({esc(hdr_id)}, {esc(DS_ID)}, {esc(tname)}, NULL, 'table', {esc(schema_meta)}, {esc(tdesc)}, 1, 0, {esc(ADMIN)}, {esc(NOW)}, {esc(NOW)})
ON DUPLICATE KEY UPDATE description=VALUES(description), is_active=1, is_hidden=0, updated_at=VALUES(updated_at);""")

    for display_order, (cn, ct, nullable, pk, fkt, fkc, cdesc, bm, ev) in enumerate(cols):
        fid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"mef_{DS_ID}_{tname}_{cn}"))
        lines.append(f"""INSERT INTO metadata_entity_field
  (id, entity_header_id, field_name, data_type, is_nullable, is_primary_key, is_foreign_key, foreign_key_table, foreign_key_column, description, is_display_field, is_searchable, display_order, created_at, updated_at)
VALUES
  ({esc(fid)}, {esc(hdr_id)}, {esc(cn)}, {esc(ct)}, {bool_val(nullable)}, {bool_val(pk)}, {bool_val(fkt)}, {esc(fkt)}, {esc(fkc)}, {esc(cdesc)}, {bool_val(not pk and cn not in ('created_at','updated_at'))}, 1, {display_order}, {esc(NOW)}, {esc(NOW)})
ON DUPLICATE KEY UPDATE description=VALUES(description), data_type=VALUES(data_type), updated_at=VALUES(updated_at);""")

        # schema_field_instructions for fields with rich descriptions
        if cdesc or bm or ev:
            sfi_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"sfi_{DS_ID}_{tname}_{cn}"))
            combined_llm = ""
            if bm: combined_llm += f"Business meaning: {bm}. "
            if fkt: combined_llm += f"Foreign key to {fkt}.{fkc}. "
            constraints_val = None
            if pk: constraints_val = json.dumps({"primaryKey": True})
            if not nullable and not pk:
                constraints_val = json.dumps({"required": True})
            lines.append(f"""INSERT INTO schema_field_instructions
  (id, data_source_id, table_name, field_name, field_type, is_nullable, is_primary_key, is_foreign_key, foreign_key_table, foreign_key_field, description, llm_instructions, example_values, constraints, business_meaning, created_at, updated_at, created_by, updated_by)
VALUES
  ({esc(sfi_id)}, {esc(DS_ID)}, {esc(tname)}, {esc(cn)}, {esc(ct)}, {bool_val(nullable)}, {bool_val(pk)}, {bool_val(fkt)}, {esc(fkt)}, {esc(fkc)}, {esc(cdesc)}, {esc(combined_llm.strip() or None)}, {esc(ev)}, {esc(constraints_val)}, {esc(bm)}, {esc(NOW)}, {esc(NOW)}, {esc(ADMIN)}, {esc(ADMIN)})
ON DUPLICATE KEY UPDATE description=VALUES(description), llm_instructions=VALUES(llm_instructions), example_values=VALUES(example_values), business_meaning=VALUES(business_meaning), updated_at=VALUES(updated_at);""")
    lines.append("")

# ── 4. Mark data_source as inspected ────────────────────────────────────
lines.append(f"UPDATE data_sources SET is_inspected=1, last_inspected_at={esc(NOW)}, updated_at={esc(NOW)} WHERE id={esc(DS_ID)};")
lines.append("")
lines.append("SELECT 'HMS metadata seed complete.' as status;")
lines.append(f"SELECT COUNT(*) as entity_headers FROM metadata_entity_header WHERE data_source_id={esc(DS_ID)};")
lines.append(f"SELECT COUNT(*) as entity_fields FROM metadata_entity_field mef JOIN metadata_entity_header meh ON mef.entity_header_id=meh.id WHERE meh.data_source_id={esc(DS_ID)};")
lines.append(f"SELECT COUNT(*) as table_instructions FROM schema_table_instructions WHERE data_source_id={esc(DS_ID)};")
lines.append(f"SELECT COUNT(*) as field_instructions FROM schema_field_instructions WHERE data_source_id={esc(DS_ID)};")

sql_out = "\n".join(lines)
out_path = "/tmp/hms_metadata_seed.sql"
with open(out_path, "w") as f:
    f.write(sql_out)

print(f"SQL written to {out_path} ({len(sql_out):,} bytes, {len(lines)} lines)")
