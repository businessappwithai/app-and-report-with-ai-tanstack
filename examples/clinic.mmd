Comprehensive System Architecture and Declarative Domain-Specific Language Design for North American Clinical AutomationThe structural modernization of clinical operations in the United States and Canada requires an architecture that unites client-facing front-office systems, core clinical Electronic Medical Records (EMR), and back-office billing networks. Historically, healthcare systems have relied on isolated software suites that require manual intervention to synchronize scheduling, clinical charting, and insurance claims. This structural fragmentation introduces operational drag, increases the risk of transcription errors, and complicates compliance with geographic regulatory mandates.To address these challenges, this system design uses a declarative compilation approach. By specifying clinical operations through a unified Entity Modeling Language (EML), database schemas, business validation rules, and client-side reactive state trees are derived from a single source of truth. This design ensures that transactional data, state-machine transitions, and compliance boundaries remain synchronized, providing an adaptable framework for modern clinical practices.Architectural Alignment of Multijurisdictional Clinical OperationsOperating a clinical system across the United States and Canada requires an architecture that can adapt to different regulatory and financial requirements. While clinical charting and resource scheduling follow similar patterns in both countries, the compliance, identity, and billing frameworks are distinct. To support these differences without maintaining separate databases, the core data model uses polymorphic mappings that resolve localized attributes at runtime.A primary architectural challenge is the division between the single-payer provincial ministries of Canada and the multi-payer commercial and government networks of the United States. In the United States, transactions rely on the EDI ASC X12 837P standard for professional claims, requiring structured fields for insurance groups, subscriber IDs, and prior authorizations. In contrast, Canadian billing is managed by provincial ministries, such as Ontario's MC EDT, British Columbia's Teleplan, or Quebec's RAMQ, which use proprietary flat-file batch formats. The clinical system must normalize these billing models while supporting different clinical classification systems, such as ICD-10-CM in the United States and ICD-10-CA in Canada.The table below outlines the core operational and regulatory requirements that the system design must accommodate across both jurisdictions:Architectural ParameterUnited States Clinical RequirementsCanadian Clinical RequirementsRegulatory Compliance FrameworksHIPAA (Health Insurance Portability and Accountability Act), HITECH Act, ONC Cures Act Rule.PIPEDA (Federal), PHIPA (Ontario), PIPA (Alberta/BC), Law 25 (Quebec).Primary Patient IdentifiersSocial Security Number (SSN), Employer Group Health Insurance Member IDs.Provincial Health Card Number (HCN) with regional validation and version codes.Clinical Classification VocabulariesICD-10-CM (Diagnoses), CPT (Procedures), HCPCS Level II (Supplies), SNOMED-CT.ICD-10-CA (Diagnoses), Canadian Classification of Health Interventions (CCI), provincial procedure codes.Financial Reinsurance ModelsCommercial Multi-Payer (PPO/HMO), Medicare, Medicaid, clearinghouse routing (EDI ASC X12 837P).Provincial Single-Payer public ministries (e.g., OHIP, Teleplan, RAMQ) using proprietary batch file uploads.Electronic Prescription NetworksSurescripts network integration, Electronic Prior Authorization (ePA) pipelines.Canada Health Infoway PrescribeIT integration, provincial Drug Information Systems (DIS).Physical Data Residency RulesCloud hosting allowed globally with executed Business Associate Agreements (BAAs).Strict provincial requirements requiring healthcare data to reside within geographical boundaries.The Entity Modeling Language SpecificationThe system's schema, relationships, workflows, and business rules are specified using the Entity Modeling Language (EML). This declarative domain-specific language represents clinical operations as a unified model. The EML compilation pipeline processes these declarative source files (.eml.mmdux) to generate physical database DDL scripts, API validation middleware, and front-end state-management reducers.The language structure is organized into a modular specification layout derived from the clinical system's blueprint architecture:Grammar and Compilation Foundations (00-overview.md): Defines the lexical parser, tokenization patterns, and syntax verification engine used to translate human-readable declarations into structured compiler outputs.Entity-Relationship Modeling Specifications (01-erd.md): Configures table definitions, relational mappings, and primary or foreign key boundaries.Transactional Business Rules (02-business-rules.md): Implements pre-commit and post-commit assertions, compliance checks, and validation logic at the database layer.State-Machine Workflows (03-workflows.md): Defines event-driven lifecycles for clinical and administrative processes, including valid state transitions and transition guards.Typing and Structural Modifiers (04-types-and-modifiers.md): Enforces variable typing and configures security and indexing modifiers.Meta-Directives and Target Demarcators (05-directives.md): Manages conditional compilation settings, target database outputs, and regional compliance configurations.A key aspect of this language design is its integration with the reactive front-end interface. Rather than treating state management as a separate concern, EML uses mmDux—a predictable state container modeled after Redux principles and optimized for synchronized rendering. The EML compiler reads workflow definitions and automatically generates reactive state stores, action creators, and combined reducers.When clinical events occur, such as a patient checking in at the front desk, the action is dispatched through the generated mmDux middleware, updating the local UI state immutably before writing the transaction to the backend database. This design keeps the administrative front-office and the practitioner's charting dashboard synchronized in real-time.The structural layers of the parsing and compilation engine are summarized below:EML File ReferenceTechnical ObjectiveCompiled Target Outputs00-overview.mdEstablishes the core language grammar, parsing patterns, and token boundaries.Parser files, AST validation logs, syntax highlighting tokens.01-erd.mdDefines entity schemas, attributes, primary/foreign keys, and cardinalities.PostgreSQL DDL scripts, Prisma/Drizzle schemas, TypeScript models.02-business-rules.mdSpecifies programmatic assertions, validation checks, and trigger events.Database check constraints, pre-save hook functions, API validation middleware.03-workflows.mdModels event-driven state transitions, status flows, and guard conditions.State-machine state structures, mmDux reducers and action creators.04-types-and-modifiers.mdConfigures typing systems and attributes such as [pk], [required], and [sensitive].Encrypted database column configurations, primary keys, and index mappings.05-directives.mdImplements compiler meta-directives such as @target or @security decorators.AWS CloudFormation files, Terraform deployment templates, localized database schemas.Comprehensive Clinic Schema and Data DictionaryThe clinical automation database schema must balance fast read/write times with relational integrity. To prevent performance bottlenecks during concurrent front-office scheduling and clinical charting, the schema separates high-frequency scheduling records from clinical encounter details. This separation maintains system performance even during peak triage periods.The following tables define the core entities of the clinical database, using the modifiers and typing rules of the EML specification.Patient Entity (Administrative and Clinical Root)The Patient entity serves as the root demographic record. To prevent database NULL pollution, regional identifiers like Canadian Health Card Numbers or US insurance fields are stored as polymorphic structures that are resolved dynamically based on the patient's country of residence.Field NameTypeModifiersFunctional Applicationpatient_idUUID[pk]Globally unique immutable record identifier.first_nameString[required]Legal first name of the patient.last_nameString[required, index]Legal last name, indexed for rapid administrative queries.birth_dateDate[required]Legal date of birth, used for age verification and validation checks.genderString[required]Administrative gender matching demographic records.national_idString[unique, sensitive]Social Security Number (US) or Social Insurance Number (Canada), encrypted at rest.prov_health_numberString[unique, sensitive]Canadian Provincial Health Card Number, null in the United States.emailString[unique, required]Contact email address, serving as the unique portal credential.phoneString[required]Contact phone number used for SMS alerts and identity verification.residence_countryString[required, index]ISO 2-letter country code (US or CA), determining compliance routing.created_atDateTime[required]System timestamp of initial patient record creation.Practitioner Entity (Clinical Providers)The Practitioner entity stores credentialing and licensing details for the clinic's healthcare providers. It supports both the US National Provider Identifier (NPI) and Canadian provincial billing identifiers.Field NameTypeModifiersFunctional Applicationpractitioner_idUUID[pk]Globally unique immutable identifier for the provider.npi_numberString[unique]United States National Provider Identifier, null in Canada.billing_numberString[unique]Canadian Provincial Billing Number, null in the United States.license_numberString[required]Licensing identifier verified against regional regulatory registries.first_nameString[required]Legal first name of the practitioner.last_nameString[required]Legal last name of the practitioner.specialtyString[required, index]Primary medical taxonomy, indexed to support patient matching.Appointment Entity (Scheduling Operations)The Appointment entity manages scheduling workflows. This structural layer is decoupled from clinical and financial modules to ensure that rapid administrative updates do not interfere with clinical documentation pipelines.Field NameTypeModifiersFunctional Applicationappointment_idUUID[pk]Globally unique identifier for the booking transaction.patient_idUUID[required, index]Relational key mapping to the Patient record.practitioner_idUUID[required, index]Relational key mapping to the scheduled Practitioner.scheduled_startDateTime[required, index]Start time of the clinical appointment slot.scheduled_endDateTime[required]End time of the clinical appointment slot.current_stateString[required]Workflow status state (e.g., Proposed, Confirmed, CheckedIn).Encounter Entity (Clinical EMR Records)The Encounter entity represents the patient's medical record for a specific clinical visit. It uses cryptographic signatures to lock notes upon practitioner sign-off, ensuring data integrity.Field NameTypeModifiersFunctional Applicationencounter_idUUID[pk]Globally unique identifier for the clinical event.appointment_idUUID[unique]One-to-one mapping to the scheduling record.patient_idUUID[required, index]Relational key mapping to the Patient record.practitioner_idUUID[required]Relational key mapping to the authoring Practitioner.subjective_notesStringNoneNarrative capturing patient symptoms and history of present illness.objective_notesStringNoneStructured data capturing vital signs and objective findings.assessmentString[required]Clinical assessment, mapped to SNOMED-CT or ICD classification databases.plan_notesString[required]Plan of care, including prescriptions and referral directions.cryptographic_sigString[required]Digital signature generated with the provider's key, locking the record.Claim Entity (Billing and Finance Records)The Claim entity handles financial processing. It maps directly to clinical encounter records, ensuring that every submission is backed by signed medical documentation.Field NameTypeModifiersFunctional Applicationclaim_idUUID[pk]Globally unique identifier for the financial claim.encounter_idUUID[required, unique]One-to-one mapping verifying clinical authorization of the claim.payer_typeString[required]Payer model category (e.g., US_Commercial, CA_Provincial).icd_codeString[required]Diagnostic classification code justifying the claim.procedure_codeString[required]Procedure code mapping to clinical services rendered.total_chargeDecimal[required]Monies billed for the clinical services.claim_stateString[required]Financial workflow execution state (e.g., Draft, Audited, Transmitted).Integrated Declarative EML Source RepresentationThe declarative specification below demonstrates how EML syntax represents entities, relationships, workflows, and business rules within a single, integrated source file (clinic_automation.eml.mmdux):// clinic_automation.eml.mmdux
// Declarative Model for North American Clinical Automation

@target: "PostgreSQL"
@localize: "Multijurisdictional"
@security: "TransparentDatabaseEncryption"

// ==========================================
// Entity Definitions
// ==========================================

entity Patient {
    patient_id: UUID [pk]
    first_name: String [required]
    last_name: String [required, index]
    birth_date: Date [required]
    gender: String [required]
    national_id: String [unique, sensitive]
    prov_health_number: String [unique, sensitive]
    email: String [unique, required]
    phone: String [required]
    residence_country: String [required, index]
    created_at: DateTime [required]
}

entity Practitioner {
    practitioner_id: UUID [pk]
    npi_number: String [unique]
    billing_number: String [unique]
    license_number: String [required]
    first_name: String [required]
    last_name: String [required]
    specialty: String [required, index]
}

entity Appointment {
    appointment_id: UUID [pk]
    patient_id: UUID [required, index]
    practitioner_id: UUID [required, index]
    scheduled_start: DateTime [required, index]
    scheduled_end: DateTime [required]
    current_state: String [required]
}

entity Encounter {
    encounter_id: UUID [pk]
    appointment_id: UUID [unique]
    patient_id: UUID [required, index]
    practitioner_id: UUID [required]
    subjective_notes: String
    objective_notes: String
    assessment: String [required]
    plan_notes: String [required]
    cryptographic_sig: String [required]
}

entity Claim {
    claim_id: UUID [pk]
    encounter_id: UUID [required, unique]
    payer_type: String [required]
    icd_code: String [required]
    procedure_code: String [required]
    total_charge: Decimal [required]
    claim_state: String [required]
}

// ==========================================
// Relational Topologies
// ==========================================

relationship PatientAppointments {
    Patient [1] -> [0..*] Appointment
    on_delete: restrict
}

relationship PractitionerAppointments {
    Practitioner [1] -> [0..*] Appointment
    on_delete: restrict
}

relationship AppointmentEncounter {
    Appointment [1] -> [0..1] Encounter
    on_delete: cascade
}

relationship PatientEncounters {
    Patient [1] -> [0..*] Encounter
    on_delete: restrict
}

relationship EncounterClaim {
    Encounter [1] -> [0..1] Claim
    on_delete: restrict
}

// ==========================================
// State-Machine Workflows
// ==========================================

workflow FrontOfficeScheduling {
    state Proposed {
        on: system_propose -> Proposed
        on: staff_confirm -> Confirmed
        on: patient_cancel -> Cancelled
    }
    state Confirmed {
        on: patient_check_in -> CheckedIn
        on: patient_cancel -> Cancelled
        on: provider_no_show -> NoShow
    }
    state CheckedIn {
        on: triage_complete -> ActiveEncounter
        on: patient_leave -> NoShow
    }
    state ActiveEncounter {
        on: encounter_close -> Completed
    }
    state Cancelled
    state NoShow
    state Completed
}

workflow ClinicalDocumentation {
    state Draft {
        on: note_autosave -> Draft
        on: practitioner_sign -> Signed
    }
    state Signed {
        on: clinical_audit_review -> Signed
        on: regulatory_lock -> Locked
    }
    state Locked
}

workflow BackOfficeBilling {
    state Draft {
        on: populate_codes -> ReadyForAudit
        on: claim_discard -> Voided
    }
    state ReadyForAudit {
        on: audit_pass -> Audited
        on: audit_fail -> Draft
    }
    state Audited {
        on: electronic_submission -> Transmitted
    }
    state Transmitted {
        on: clearinghouse_accept -> Acknowledged
        on: clearinghouse_reject -> Draft
        on: payer_adjudication_approve -> Paid
        on: payer_adjudication_deny -> Denied
    }
    state Acknowledged
    state Paid
    state Denied
    state Voided
}

// ==========================================
// Business Rules
// ==========================================

rule ValidateHIPAAAndPIPEDACompliance {
    on: Patient.create, Patient.update
    assert: (
        is_encrypted(Patient.national_id) && 
        is_encrypted(Patient.prov_health_number) &&
        has_active_consent(Patient.patient_id)
    )
    message: "Critical demographic fields must remain encrypted, and active patient consent must be verified."
}

rule ValidateClinicalDocumentationSignature {
    on: Encounter.update
    assert: (
        Encounter.current_state == "Signed" ? 
        verify_rsa_signature(Encounter.encounter_id, Encounter.cryptographic_sig, Encounter.practitioner_id) : 
        true
    )
    message: "Signed clinical encounters require a validated cryptographic signature bound to the authoring provider."
}

rule ValidateClaimsCoding {
    on: Claim.create, Claim.update
    assert: (
        is_valid_icd_format(Claim.icd_code) && 
        is_valid_procedure_format(Claim.procedure_code)
    )
    message: "Claims submissions must utilize properly formatted ICD and procedural codes."
}

rule ValidateCrossBorderDataResidency {
    on: Patient.create
    assert: (
        Patient.residence_country == "CA" ? 
        enforce_geographic_hosting(Patient.patient_id, "Canada_Central_AWS") : 
        enforce_geographic_hosting(Patient.patient_id, "US_East_AWS")
    )
    message: "Canadian patient data must be hosted in Canadian cloud facilities; US patient data must be hosted in US facilities."
}
Relational Topologies and Integrity ModifiersThe relationships within the clinical system's data model enforce data integrity while preventing operational deadlocks during high-volume periods. Relationships are defined with clean, directional mappings and explicit cascade behaviors to prevent orphaned data records.The clinical relational model is structured around key operational guidelines:Patient to Appointments (1 to 0..*): A patient can book multiple appointments over time. To preserve medical histories, deleting a patient demographic record is blocked if active appointments exist (on_delete: restrict).Practitioner to Appointments (1 to 0..*): A practitioner has many scheduled appointments. Deleting a practitioner record is restricted to prevent scheduling conflicts and preserve historical operational logs.Appointment to Encounter (1 to 0..1): An appointment may result in a clinical encounter. If an appointment is cancelled before triage occurs, removing the scheduling entry clean-cascades (on_delete: cascade), removing unfulfilled database metadata without affecting historical clinical records.Patient to Encounters (1 to 0..*): A patient has many clinical encounters over their lifecycle. Deleting patient records is restricted once clinical data has been written, ensuring EMR audits remain compliant with regulatory retention periods.Encounter to Claim (1 to 0..1): A completed encounter may generate a single billing claim. Deleting clinical encounter data is restricted if a financial billing record has been created, maintaining a clear audit trail for administrative and billing reviews.These rules ensure database safety and referential consistency:Relational DeclarationCardinality ConstraintOperational Delete RuleStructural Database EnforcementPatientAppointments1 to 0..*[cite: 7]on_delete: restrictForeign key constraint in the Appointment table blocks removal of the root patient record if appointments exist.PractitionerAppointments1 to 0..*on_delete: restrictForeign key constraint in the Appointment table blocks practitioner deletion if active schedules exist.AppointmentEncounter1 to 0..1[cite: 7]on_delete: cascadeCascade delete automatically removes empty scheduling metadata if an appointment is cleared prior to clinical check-in.PatientEncounters1 to 0..*on_delete: restrictProtects historical medical records; EMR charts cannot be orphaned by deleting patient profiles.EncounterClaim1 to 0..1[cite: 7]on_delete: restrictRestricts removal of clinical evidence if financial claims exist, maintaining auditing trails.Event-Driven State-Machine WorkflowsA medical system handles complex, state-dependent sequences across its scheduling, charting, and billing modules. EML models these processes as event-driven state machines, ensuring that transitions between states are validated and auditable.These workflows operate in a coordinated sequence:[ Scheduling Workflow ]                           [ Clinical Note Workflow ]                    [ Billing Claim Workflow ]
 
   (Proposed)                                         (Draft Encounter)                            (Draft Claim Record)
        │                                                     │                                             │
        ▼ (staff_confirm)                                     ▼ (note_autosave)                             ▼ (populate_codes)
   (Confirmed)                                        (Draft Encounter)                            (ReadyForAudit State)
        │                                                     │                                             │
        ▼ (patient_check_in)                                  ▼ (practitioner_sign)                         ▼ (audit_pass)
   (CheckedIn)   ───[Auto-Generates Shell Note]───►   (Signed Encounter)                            (Audited Claim Record)
        │                                                     │                                             │
        ▼ (triage_complete)                                   ▼ (regulatory_lock)                           ▼ (electronic_submission)
(ActiveEncounter)                                     (Locked Encounter)                            (Transmitted State)
        │                                                                                                   │
        ▼ (encounter_close)                                                                                 ▼
   (Completed)   ───[Triggers Billing Draft]────────────────────────────────────────────────────────► (Adjudicated Paid/Denied)
The system uses queueing theory to optimize scheduling and check-in workflows, helping manage wait times during peak periods. In a multi-doctor clinic, the front-office dashboard calculates wait times using the standard $W_q$ queueing formula:$$W_q = \frac{\lambda}{\mu(\mu - \lambda)}$$In this model, $\lambda$ represents the average patient arrival rate per hour and $\mu$ represents the average clinical triage rate per hour. If clinical times exceed expectations (where $\mu$ approaches $\lambda$), wait times rise exponentially. The system's scheduling engine monitors these arrival and triage rates in real-time. If wait times exceed configured limits, the scheduling engine can dynamically route upcoming appointments to other available rooms or alert patients of delays, helping manage clinic flow.The state transitions and triggers across the three core workflows are detailed below:Workflow PipelineOrigin StateTrigger EventDestination StateSystem Action & State ImpactFront-Office SchedulingNonesystem_proposeProposedReserves a time slot on the calendar and generates a temporary identifier.Proposedstaff_confirmConfirmedConfirms the booking, locks the time slot, and sends an email to the patient.Confirmedpatient_check_inCheckedInUpdates the queue dashboard and automatically generates a draft EMR chart.CheckedIntriage_completeActiveEncounterAlerts the practitioner's charting dashboard that the patient is ready for evaluation.ActiveEncounterencounter_closeCompletedCompletes the appointment lifecycle and initiates the billing workflow.Clinical DocumentationNonepatient_check_inDraftCreates a draft encounter record and links it to the patient and practitioner.Draftnote_autosaveDraftSaves note updates incrementally to prevent data loss.Draftpractitioner_signSignedGenerates a cryptographic signature, locks editing fields, and starts the billing process.Signedregulatory_lockLockedAutomatically locks the medical note after the regional amendment window closes.Back-Office BillingNoneencounter_closeDraftGenerates a draft claim record containing patient and practitioner IDs.Draftpopulate_codesReadyForAuditPopulates the claim with ICD and procedure codes from the signed note.ReadyForAuditaudit_passAuditedRuns compliance validations and schedules the claim for batch submission.Auditedelectronic_submissionTransmittedFormats and transmits the claim as a US ASC X12 837P file or Canadian provincial batch.Transmittedpayer_adjudicationPaid / DeniedUpdates the claim status based on response codes from the payer or ministry.Declarative Business Rules and Cross-Border InterceptorsTo maintain security and compliance across regional borders, the system evaluates declarative business rules as pre-commit and post-commit database triggers. This design enforces HIPAA, PIPEDA, and provincial regulations at the data access layer rather than relying solely on front-end validations.A key cross-border rule is the ValidateCrossBorderDataResidency validator. Canadian provincial guidelines often require health data to reside within geographical boundaries. The EML compiler parses the residence_country attribute on patient records to enforce regional partition rules:[ Patient Record Write Request ]
               │
               ▼
   (Evaluates Patient.residence_country)
               │
       ┌───────┴───────┐
       ▼ (US)          ▼ (CA)
  [ us-east-1 ]   [ ca-central-1 ]
  (AWS Storage)   (AWS Storage)
The system also enforces cryptographic locking of medical notes upon practitioner sign-off to ensure compliance with digital signature guidelines. When a practitioner signs an encounter note, the system generates a secure SHA-256 signature containing the record's contents and the practitioner's unique credentialing keys:$$\sigma = \text{Sign}_{S_k}(\text{Hash}(E))$$In this signature calculation, $E$ represents the serialized clinical encounter data payload, $S_k$ is the practitioner's private signing key, and $\sigma$ represents the generated signature. If the encounter notes are subsequently modified without authorization, the verified signature will fail, immediately flagging the record as modified in audit logs.The pre-commit and post-commit business validation rules are structured as follows:Business Rule ReferenceTrigger Target PhaseSystem Assertions EvaluatedRegional Compliance ObjectiveValidateHIPAAAndPIPEDACompliance[cite: 1]Pre-Commit (on: Patient.create, Patient.update)is_encrypted(national_id) AND is_encrypted(prov_health_number) AND has_active_consent(patient_id)[cite: 1]Meets HIPAA requirements for encrypting Protected Health Information (PHI) and PIPEDA consent guidelines.ValidateClinicalDocumentationSignature[cite: 1]Pre-Commit (on: Encounter.update)current_state == "Signed" ? verify_rsa_signature(encounter_id, cryptographic_sig, practitioner_id)Enforces clinical accountability and prevents modification of finalized medical charts.ValidateClaimsCoding[cite: 1]Pre-Commit (on: Claim.create, Claim.update)is_valid_icd_format(icd_code) AND is_valid_procedure_format(procedure_code)Validates CPT, HCPCS, CCI, and ICD codes before submission to reduce clearinghouse rejections.ValidateCrossBorderDataResidency[cite: 1]Pre-Commit (on: Patient.create)residence_country == "CA" ? enforce_geographic_hosting(patient_id, "Canada_Central_AWS") : enforce_geographic_hosting(patient_id, "US_East_AWS")[cite: 1]Enforces regional data residency rules, keeping Canadian patient records within Canadian cloud storage facilities.Database Transformations and Production Code GenerationA primary advantage of declarative development is its ability to compile schemas into production-ready targets, reducing hand-off and translation errors. The EML compiler parses .eml.mmdux configurations and outputs optimized database schemas and data structures.The following PostgreSQL physical database schema represents the compiled output of the EML specification, including custom enums, table indexes, and referential integrity constraints:SQL-- ============================================================================
-- PostgreSQL Physical Schema Generation
-- Target Database Environment: PostgreSQL 15+ (Cloud Native Cluster)
-- Generated from clinic_automation.eml.mmdux
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define Custom Operational Workflow Enums
CREATE TYPE appointment_state AS ENUM ('Proposed', 'Confirmed', 'CheckedIn', 'ActiveEncounter', 'Cancelled', 'NoShow', 'Completed');
CREATE TYPE clinical_state AS ENUM ('Draft', 'Signed', 'Locked');
CREATE TYPE billing_state AS ENUM ('Draft', 'ReadyForAudit', 'Audited', 'Transmitted', 'Acknowledged', 'Paid', 'Denied', 'Voided');

-- Create System Tables
CREATE TABLE Patient (
    patient_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    birth_date DATE NOT NULL,
    gender VARCHAR(50) NOT NULL,
    national_id BYTEA UNIQUE,               -- Encrypted at Rest (Transparent Database Encryption)
    prov_health_number BYTEA UNIQUE,        -- Encrypted at Rest (Transparent Database Encryption)
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) NOT NULL,
    residence_country CHAR(2) NOT NULL DEFAULT 'US',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE Practitioner (
    practitioner_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    npi_number VARCHAR(10) UNIQUE,          -- Specific to US Billing Integrations
    billing_number VARCHAR(50) UNIQUE,      -- Specific to Canadian Ministry Integrations
    license_number VARCHAR(100) NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    specialty VARCHAR(255) NOT NULL
);

CREATE TABLE Appointment (
    appointment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL,
    practitioner_id UUID NOT NULL,
    scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
    current_state appointment_state NOT NULL DEFAULT 'Proposed',
    CONSTRAINT fk_patient FOREIGN KEY (patient_id) REFERENCES Patient(patient_id) ON DELETE RESTRICT,
    CONSTRAINT fk_practitioner FOREIGN KEY (practitioner_id) REFERENCES Practitioner(practitioner_id) ON DELETE RESTRICT
);

CREATE TABLE Encounter (
    encounter_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID UNIQUE,
    patient_id UUID NOT NULL,
    practitioner_id UUID NOT NULL,
    subjective_notes TEXT,
    objective_notes TEXT,
    assessment VARCHAR(255) NOT NULL,
    plan_notes TEXT NOT NULL,
    cryptographic_sig VARCHAR(512) NOT NULL,
    CONSTRAINT fk_encounter_appointment FOREIGN KEY (appointment_id) REFERENCES Appointment(appointment_id) ON DELETE CASCADE,
    CONSTRAINT fk_encounter_patient FOREIGN KEY (patient_id) REFERENCES Patient(patient_id) ON DELETE RESTRICT,
    CONSTRAINT fk_encounter_practitioner FOREIGN KEY (practitioner_id) REFERENCES Practitioner(practitioner_id) ON DELETE RESTRICT
);

CREATE TABLE Claim (
    claim_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    encounter_id UUID UNIQUE NOT NULL,
    payer_type VARCHAR(50) NOT NULL,
    icd_code VARCHAR(20) NOT NULL,
    procedure_code VARCHAR(20) NOT NULL,
    total_charge DECIMAL(12, 2) NOT NULL,
    claim_state billing_state NOT NULL DEFAULT 'Draft',
    CONSTRAINT fk_claim_encounter FOREIGN KEY (encounter_id) REFERENCES Encounter(encounter_id) ON DELETE RESTRICT
);

-- Establish Indexes to Support Real-Time Operations
CREATE INDEX idx_patient_last_name ON Patient(last_name);
CREATE INDEX idx_patient_residence_country ON Patient(residence_country);
CREATE INDEX idx_practitioner_specialty ON Practitioner(specialty);
CREATE INDEX idx_appointment_schedule ON Appointment(scheduled_start, scheduled_end);
CREATE INDEX idx_encounter_patient ON Encounter(patient_id);
Strategic Systemic Architecture ConclusionsThis declarative, compile-on-save architecture provides a unified framework for cross-border clinical software development. By specifying schemas, relationships, workflows, and business validation rules within a single Entity Modeling Language configuration, the system remains auditable, secure, and performant.The system's modular design separates front-office scheduling, core clinical EMR charting, and back-office billing processes, allowing developers to scale individual modules independently. This separation of concerns maintains operational efficiency during peak check-in times while ensuring that clinical encounters and billing records remain cryptographically locked and secure. By compiling source files directly into physical database structures and reactive state containers, this architecture helps clinical systems adapt to evolving healthcare requirements and regulatory rules.