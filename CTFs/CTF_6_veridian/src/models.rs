use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewRequest {
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginForm {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserFlags {
    pub flag1: String,
    pub flag2: String,
    pub flag3: String,
    pub flag4: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserCredential {
    pub password: String,
    pub role: String,
}

pub type FlagsMap = HashMap<String, UserFlags>;
pub type CredsMap = HashMap<String, UserCredential>;
