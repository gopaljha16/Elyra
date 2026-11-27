CREATE INDEX users_latitude_longitude_idx ON users(latitude,longitude);
CREATE INDEX matches_user1_user2_idx ON matches("user1Id","user2Id");
CREATE INDEX matches_user2_user1_idx ON matches("user2Id","user1Id");
