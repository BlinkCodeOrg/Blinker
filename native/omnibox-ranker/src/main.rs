use std::cmp::Ordering;
use std::io::{self, Read};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Clone)]
struct Candidate {
    index: usize,
    url: String,
    title: String,
    source: String,
    visit_count: i64,
    typed_count: i64,
    recency_time: i64,
    relevance: i64,
}

fn tokenize(value: &str) -> Vec<String> {
    let mut out = Vec::new();
    for token in value
        .to_lowercase()
        .split(|c: char| !c.is_ascii_alphanumeric() && !('а'..='я').contains(&c) && c != 'ё')
        .filter(|part| !part.is_empty())
    {
        if !out.iter().any(|existing| existing == token) {
            out.push(token.to_string());
        }
        if out.len() >= 4 {
            break;
        }
    }
    out
}

fn hostname(url: &str) -> String {
    let lower = url.to_lowercase();
    let without_scheme = lower
        .strip_prefix("https://")
        .or_else(|| lower.strip_prefix("http://"))
        .unwrap_or(&lower);
    without_scheme
        .split(['/', '?', '#'])
        .next()
        .unwrap_or("")
        .to_string()
}

fn score(candidate: &Candidate, query: &str, tokens: &[String], now: i64) -> Option<i64> {
    let query_lower = query.to_lowercase();
    let title_lower = candidate.title.to_lowercase();
    let url_lower = candidate.url.to_lowercase();
    let host = hostname(&candidate.url);

    if !tokens.iter().all(|token| {
        title_lower.contains(token) || url_lower.contains(token) || host.contains(token)
    }) {
        return None;
    }

    let mut score = if candidate.source == "bookmark" {
        610
    } else {
        470
    };

    if url_lower.starts_with(&query_lower) || host.starts_with(&query_lower) {
        score += if candidate.source == "bookmark" {
            95
        } else {
            150
        };
    }
    if title_lower.starts_with(&query_lower) {
        score += 80;
    }
    if tokens.iter().any(|token| host.starts_with(token)) {
        score += 45;
    }

    let age = now.saturating_sub(candidate.recency_time);
    let day = 24 * 60 * 60 * 1000;
    if age < day {
        score += 120;
    } else if age < 7 * day {
        score += 80;
    } else if age < 30 * day {
        score += 40;
    }

    score += (candidate.typed_count * 14).min(160);
    score += (candidate.visit_count * 3).min(100);

    Some(score.min(if candidate.source == "bookmark" {
        760
    } else {
        720
    }))
}

fn compare(left: &Candidate, right: &Candidate) -> Ordering {
    right
        .relevance
        .cmp(&left.relevance)
        .then_with(|| right.recency_time.cmp(&left.recency_time))
        .then_with(|| right.typed_count.cmp(&left.typed_count))
        .then_with(|| left.url.cmp(&right.url))
}

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).expect("stdin");

    let mut lines = input.lines();
    let query = lines.next().unwrap_or("").trim().to_string();
    let limit = lines
        .next()
        .and_then(|value| value.trim().parse::<usize>().ok())
        .unwrap_or(8)
        .clamp(1, 20);

    if query.len() < 2 {
        return;
    }

    let tokens = tokenize(&query);
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default();

    let mut ranked = Vec::new();
    for (index, line) in lines.enumerate() {
        let mut fields = line.split('\t');
        let mut candidate = Candidate {
            index,
            url: fields.next().unwrap_or("").to_string(),
            title: fields.next().unwrap_or("").to_string(),
            source: fields.next().unwrap_or("history").to_string(),
            visit_count: fields
                .next()
                .and_then(|value| value.parse().ok())
                .unwrap_or(0),
            typed_count: fields
                .next()
                .and_then(|value| value.parse().ok())
                .unwrap_or(0),
            recency_time: fields
                .next()
                .and_then(|value| value.parse().ok())
                .unwrap_or(0),
            relevance: 0,
        };

        if let Some(relevance) = score(&candidate, &query, &tokens, now) {
            candidate.relevance = relevance;
            ranked.push(candidate);
        }
    }

    ranked.sort_by(compare);
    for item in ranked.into_iter().take(limit) {
        println!("{}\t{}", item.index, item.relevance);
    }
}
