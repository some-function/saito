use crate::core::consensus::peers::peer::{Peer, PeerStatus};
use crate::core::consensus::peers::peer_state_writer::PeerStateWriter;
use crate::core::consensus::peers::rate_limiter::RateLimiter;
use crate::core::defs::{PeerIndex, PrintForLog, SaitoPublicKey, Timestamp};
use log::{debug, info};
use serde::{de, Serialize};
use std::cell::RefCell;
use std::collections::HashMap;
use std::time::Duration;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum CongestionType {
    KeyList,
    Handshake,
    Message,
    InvalidBlock,
}

#[derive(Debug, Clone, Serialize)]
pub enum PeerCongestionStatus {
    NoAction,
    Throttle(Timestamp /*Expiry Time */),
    Blacklist(Timestamp /*Expiry Time */),
}

#[derive(Debug, Clone, Serialize)]
pub struct PeerCongestionControls {
    pub controls: HashMap<CongestionType, RateLimiter>,
    pub statuses: HashMap<CongestionType, PeerCongestionStatus>,
}

impl Default for PeerCongestionControls {
    fn default() -> Self {
        let key_list_limiter = RateLimiter::new(100, Duration::from_secs(60));
        let handshake_limiter = RateLimiter::new(100, Duration::from_secs(60));
        let message_limiter = RateLimiter::new(100_000, Duration::from_secs(1));
        let invalid_block_limiter = RateLimiter::new(10, Duration::from_secs(3600));
        Self {
            controls: HashMap::from([
                (CongestionType::KeyList, key_list_limiter),
                (CongestionType::Handshake, handshake_limiter),
                (CongestionType::Message, message_limiter),
                (CongestionType::InvalidBlock, invalid_block_limiter),
            ]),
            statuses: Default::default(),
        }
    }
}

impl PeerCongestionControls {
    pub fn increase(&mut self, congestion_type: CongestionType, current_time: Timestamp) {
        if let Some(rate_limiter) = self.controls.get_mut(&congestion_type) {
            rate_limiter.increase();
            if rate_limiter.has_limit_exceeded(current_time) {
                self.statuses.insert(
                    congestion_type,
                    Self::decide_status(congestion_type, current_time),
                );
            }
        }
    }

    pub fn get_congestion_status(&mut self, current_time: Timestamp) -> PeerCongestionStatus {
        let mut current_status = PeerCongestionStatus::NoAction;

        for (congestion_type, status) in &self.statuses {
            match status {
                PeerCongestionStatus::Throttle(expiry_time) => {
                    if *expiry_time < current_time {
                        continue;
                    }
                    current_status = status.clone();
                }
                // If any status is Blacklist, we return it immediately
                PeerCongestionStatus::Blacklist(expiry_time) => {
                    if *expiry_time < current_time {
                        continue;
                    }
                    return status.clone();
                }
                _ => {}
            }
        }

        current_status
    }

    fn decide_status(
        congestion_type: CongestionType,
        current_time: Timestamp,
    ) -> PeerCongestionStatus {
        // Define the throttling and blacklisting durations for each congestion type
        match congestion_type {
            CongestionType::KeyList => PeerCongestionStatus::Throttle(current_time + 60_000), // 1 minute
            CongestionType::Handshake => PeerCongestionStatus::Throttle(current_time + 60_000), // 1 minute
            CongestionType::Message => PeerCongestionStatus::Throttle(current_time + 1_000), // 1 second
            CongestionType::InvalidBlock => {
                PeerCongestionStatus::Blacklist(current_time + 3_600_000)
            } // 1 hour
        }
    }
}
