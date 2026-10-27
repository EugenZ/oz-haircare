CREATE TABLE "journal_articles" (
	"slug" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"document" jsonb NOT NULL
);
