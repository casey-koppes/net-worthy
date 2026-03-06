CREATE TABLE "item_value_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"item_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"value_encrypted" text NOT NULL,
	"is_asset" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item_value_snapshots" ADD CONSTRAINT "item_value_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;