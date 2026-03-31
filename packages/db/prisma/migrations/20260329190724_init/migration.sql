-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "RoomMode" AS ENUM ('matchmaking', 'dual_battle', 'private');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('waiting', 'in_progress', 'finished', 'abandoned');

-- CreateEnum
CREATE TYPE "PlayerRole" AS ENUM ('player', 'spectator');

-- CreateEnum
CREATE TYPE "Team" AS ENUM ('red', 'blue', 'none');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('selecting', 'drawing', 'finished', 'skipped');

-- CreateEnum
CREATE TYPE "StrokeOpType" AS ENUM ('draw', 'fill', 'undo', 'clear', 'erase');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" CITEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "avatar_s3_key" TEXT,
    "total_score" BIGINT NOT NULL DEFAULT 0,
    "games_played" INTEGER NOT NULL DEFAULT 0,
    "games_won" INTEGER NOT NULL DEFAULT 0,
    "is_guest" BOOLEAN NOT NULL DEFAULT false,
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "device_hint" VARCHAR(64),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "word_packs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(64) NOT NULL,
    "owner_user_id" UUID,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "word_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "words" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pack_id" UUID NOT NULL,
    "word" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'medium',
    "times_used" INTEGER NOT NULL DEFAULT 0,
    "times_guessed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "words_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(6) NOT NULL,
    "mode" "RoomMode" NOT NULL,
    "host_user_id" UUID,
    "status" "RoomStatus" NOT NULL DEFAULT 'waiting',
    "password_hash" TEXT,
    "max_players" SMALLINT NOT NULL DEFAULT 8,
    "round_count" SMALLINT NOT NULL DEFAULT 3,
    "draw_time_secs" SMALLINT NOT NULL DEFAULT 80,
    "word_pack_id" UUID,
    "allow_spectators" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_players" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "room_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "PlayerRole" NOT NULL DEFAULT 'player',
    "team" "Team" NOT NULL DEFAULT 'none',
    "seat_order" SMALLINT NOT NULL,
    "total_score" INTEGER NOT NULL DEFAULT 0,
    "is_connected" BOOLEAN NOT NULL DEFAULT true,
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ,

    CONSTRAINT "room_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "room_id" UUID NOT NULL,
    "round_number" SMALLINT NOT NULL,
    "drawer_user_id" UUID NOT NULL,
    "team" "Team" NOT NULL DEFAULT 'none',
    "word" TEXT NOT NULL,
    "word_difficulty" "Difficulty" NOT NULL DEFAULT 'medium',
    "status" "RoundStatus" NOT NULL DEFAULT 'selecting',
    "started_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ,
    "replay_s3_key" TEXT,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strokes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "round_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "op_type" "StrokeOpType" NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strokes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guesses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "round_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "team" "Team" NOT NULL DEFAULT 'none',
    "guess_text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "score_awarded" INTEGER NOT NULL DEFAULT 0,
    "guessed_at_elapsed_ms" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "room_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "final_rank" SMALLINT NOT NULL,
    "final_score" INTEGER NOT NULL,
    "score_delta" INTEGER NOT NULL,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_score" ON "users"("total_score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_code_key" ON "rooms"("code");

-- CreateIndex
CREATE INDEX "idx_rooms_code" ON "rooms"("code");

-- CreateIndex
CREATE INDEX "idx_room_players_room_active" ON "room_players"("room_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_players_room_id_user_id_key" ON "room_players"("room_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_rounds_room" ON "rounds"("room_id", "round_number");

-- CreateIndex
CREATE UNIQUE INDEX "rounds_room_id_round_number_team_key" ON "rounds"("room_id", "round_number", "team");

-- CreateIndex
CREATE INDEX "idx_strokes_round_seq" ON "strokes"("round_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "strokes_round_id_sequence_key" ON "strokes"("round_id", "sequence");

-- CreateIndex
CREATE INDEX "idx_guesses_round" ON "guesses"("round_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_results_room_id_user_id_key" ON "game_results"("room_id", "user_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_packs" ADD CONSTRAINT "word_packs_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "words" ADD CONSTRAINT "words_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "word_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_word_pack_id_fkey" FOREIGN KEY ("word_pack_id") REFERENCES "word_packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_players" ADD CONSTRAINT "room_players_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_players" ADD CONSTRAINT "room_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_drawer_user_id_fkey" FOREIGN KEY ("drawer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strokes" ADD CONSTRAINT "strokes_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guesses" ADD CONSTRAINT "guesses_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guesses" ADD CONSTRAINT "guesses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
