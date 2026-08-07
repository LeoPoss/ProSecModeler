CREATE TABLE `assessment_value` (
	`assessment_id` integer NOT NULL,
	`attribute_id` integer NOT NULL,
	`process_element_id` integer NOT NULL,
	`recorded_value` text,
	PRIMARY KEY(`assessment_id`, `attribute_id`, `process_element_id`),
	FOREIGN KEY (`assessment_id`) REFERENCES `audit_assessment`(`assessment_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attribute_id`) REFERENCES `evaluation_attribute`(`attribute_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`process_element_id`) REFERENCES `process_element`(`element_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `audit_assessment` (
	`assessment_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`audit_type` text NOT NULL,
	`process_id` integer,
	FOREIGN KEY (`process_id`) REFERENCES `business_process`(`process_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `business_process` (
	`process_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`process_name` text NOT NULL,
	`bpmn_definition` text
);
--> statement-breakpoint
CREATE TABLE `compliance_requirement_attribute` (
	`requirement_id` integer NOT NULL,
	`attribute_id` integer NOT NULL,
	PRIMARY KEY(`requirement_id`, `attribute_id`),
	FOREIGN KEY (`requirement_id`) REFERENCES `compliance_requirement`(`requirement_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attribute_id`) REFERENCES `evaluation_attribute`(`attribute_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `compliance_requirement` (
	`requirement_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`standard_id` integer NOT NULL,
	`description` text,
	`question` text,
	FOREIGN KEY (`standard_id`) REFERENCES `regulation_standard`(`standard_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `evaluation_attribute` (
	`attribute_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`target_scope` text,
	`data_type` text DEFAULT 'BooleanToggle',
	`options` text,
	`external_id` text,
	`category` text,
	`subcategory` text,
	`further_specification` text,
	`annotation_template` text
);
--> statement-breakpoint
CREATE TABLE `process_element` (
	`element_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`process_id` integer NOT NULL,
	`element_type` text NOT NULL,
	`bpmn_element_id` text,
	`display_name` text,
	FOREIGN KEY (`process_id`) REFERENCES `business_process`(`process_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `regulation_standard` (
	`standard_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`security_level` text
);
