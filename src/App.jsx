import { useEffect, useMemo, useState } from "react";
import "./App.css";

const baseFormations = {
  "7v7": [["ST"], ["LM", "CM", "RM"], ["LB", "CB", "RB"], ["GK"]],
  "9v9": [["ST1", "ST2"], ["LM", "CM", "RM"], ["LB", "CB", "RB"], ["GK"]],
  "11v11": [["ST"], ["LW", "CAM", "RW"], ["CDM", "CM"], ["LB", "LCB", "RCB", "RB"], ["GK"]],
};

const storageKey = "soccer-coach-app-v8";
const legacyStorageKeys = [
  "soccer-coach-app-v7",
  "soccer-coach-app-v6",
  "soccer-coach-app-v5",
  "soccer-coach-app-v4",
];

function newId() {
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function makePlayer(name, isGuest = false) {
  return {
    id: newId(),
    name,
    isGuest,
    onField: false,
    position: "Bench",
    fieldTime: 0,
    currentFieldTime: 0,
    benchTime: 0,
    goals: 0,
    assists: 0,
    seasonGoals: 0,
    seasonAssists: 0,
    seasonMinutes: 0,
  };
}

export default function App() {
  const [format, setFormat] = useState("9v9");
  const [players, setPlayers] = useState([]);
  const [newPlayer, setNewPlayer] = useState("");
  const [newGuestPlayer, setNewGuestPlayer] = useState("");
  const [running, setRunning] = useState(false);
  const [teamGoals, setTeamGoals] = useState(0);
  const [oppGoals, setOppGoals] = useState(0);
  const [scorerId, setScorerId] = useState("");
  const [assistId, setAssistId] = useState("none");
  const [games, setGames] = useState([]);
  const [screen, setScreen] = useState("formation");
  const [menuOpen, setMenuOpen] = useState(false);
  const [goalPanelOpen, setGoalPanelOpen] = useState(false);
  const [fieldFlipped, setFieldFlipped] = useState(false);
  const [halfLengthMinutes, setHalfLengthMinutes] = useState(30);
  const [currentHalf, setCurrentHalf] = useState(1);
  const [halfSecondsLeft, setHalfSecondsLeft] = useState(30 * 60);

  const formationRows = fieldFlipped ? [...baseFormations[format]].reverse() : baseFormations[format];
  const positions = baseFormations[format].flat();

  useEffect(() => {
    let saved = localStorage.getItem(storageKey);

    if (!saved) {
      for (const oldKey of legacyStorageKeys) {
        const oldSaved = localStorage.getItem(oldKey);
        if (oldSaved) {
          saved = oldSaved;
          localStorage.setItem(storageKey, oldSaved);
          break;
        }
      }
    }

    if (saved) {
      const data = JSON.parse(saved);
      setFormat(data.format || "9v9");
      setPlayers(data.players || []);
      setTeamGoals(data.teamGoals || 0);
      setOppGoals(data.oppGoals || 0);
      setGames(data.games || []);
      setFieldFlipped(data.fieldFlipped || false);
      setHalfLengthMinutes(data.halfLengthMinutes || 30);
      setCurrentHalf(data.currentHalf || 1);
      setHalfSecondsLeft(data.halfSecondsLeft ?? (data.halfLengthMinutes || 30) * 60);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ format, players, teamGoals, oppGoals, games, fieldFlipped, halfLengthMinutes, currentHalf, halfSecondsLeft })
    );
  }, [format, players, teamGoals, oppGoals, games, fieldFlipped, halfLengthMinutes, currentHalf, halfSecondsLeft]);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setPlayers((currentPlayers) =>
        currentPlayers.map((player) => ({
          ...player,
          fieldTime: player.onField ? player.fieldTime + 1 : player.fieldTime,
          currentFieldTime: player.onField ? (player.currentFieldTime || 0) + 1 : 0,
          benchTime: player.onField ? 0 : player.benchTime + 1,
        }))
      );
      setHalfSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  const onField = useMemo(() => players.filter((p) => p.onField), [players]);
  const bench = useMemo(() => players.filter((p) => !p.onField), [players]);
  const urgentBench = bench.filter((p) => p.benchTime > 300).length;
  const longestShift = useMemo(
    () => [...onField].sort((a, b) => (b.currentFieldTime || 0) - (a.currentFieldTime || 0))[0],
    [onField]
  );

  function addPlayer() {
    if (!newPlayer.trim()) return;
    setPlayers([...players, makePlayer(newPlayer.trim(), false)]);
    setNewPlayer("");
  }

  function addGuestPlayer() {
    if (!newGuestPlayer.trim()) return;
    setPlayers([...players, makePlayer(newGuestPlayer.trim(), true)]);
    setNewGuestPlayer("");
  }

  function deletePlayer(id) {
    setPlayers(players.filter((p) => p.id !== id));
  }

  function assignPlayer(playerId, position) {
    if (!playerId) return;
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) => {
        if (player.id === playerId) return { ...player, onField: true, position, benchTime: 0, currentFieldTime: 0 };
        if (player.position === position) return { ...player, onField: false, position: "Bench", benchTime: 0, currentFieldTime: 0 };
        return player;
      })
    );
  }

  function sendToBench(playerId) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) =>
        player.id === playerId ? { ...player, onField: false, position: "Bench", benchTime: 0, currentFieldTime: 0 } : player
      )
    );
  }

  function subPlayers(benchPlayerId, fieldPlayerId) {
    const fieldPlayer = players.find((p) => p.id === fieldPlayerId);
    if (!fieldPlayer) return;
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) => {
        if (player.id === benchPlayerId) return { ...player, onField: true, position: fieldPlayer.position, benchTime: 0, currentFieldTime: 0 };
        if (player.id === fieldPlayerId) return { ...player, onField: false, position: "Bench", benchTime: 0, currentFieldTime: 0 };
        return player;
      })
    );
  }

  function recordOurGoal() {
    if (!scorerId) return;
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) => ({
        ...player,
        goals: player.id === scorerId ? player.goals + 1 : player.goals,
        assists: player.id === assistId ? player.assists + 1 : player.assists,
      }))
    );
    setTeamGoals(teamGoals + 1);
    setScorerId("");
    setAssistId("none");
    setGoalPanelOpen(false);
  }

  function resetHalfTimer() {
    setHalfSecondsLeft(halfLengthMinutes * 60);
  }

  function updateHalfLength(minutes) {
    const value = Number(minutes);
    setHalfLengthMinutes(value);
    setHalfSecondsLeft(value * 60);
  }

  function nextHalf() {
    setCurrentHalf((half) => half + 1);
    setHalfSecondsLeft(halfLengthMinutes * 60);
    setRunning(false);
  }

  function saveGameToSeason() {
    const finishedGame = {
      id: newId(),
      date: new Date().toLocaleDateString(),
      score: `${teamGoals}-${oppGoals}`,
      format,
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        isGuest: p.isGuest,
        goals: p.goals,
        assists: p.assists,
        minutes: Math.round(p.fieldTime / 60),
      })),
    };

    setGames([finishedGame, ...games]);
    setPlayers((currentPlayers) =>
      currentPlayers
        .filter((player) => !player.isGuest)
        .map((player) => ({
          ...player,
          seasonGoals: player.seasonGoals + player.goals,
          seasonAssists: player.seasonAssists + player.assists,
          seasonMinutes: player.seasonMinutes + Math.round(player.fieldTime / 60),
          goals: 0,
          assists: 0,
          fieldTime: 0,
          currentFieldTime: 0,
          benchTime: 0,
          onField: false,
          position: "Bench",
        }))
    );
    setTeamGoals(0);
    setOppGoals(0);
    setRunning(false);
    setCurrentHalf(1);
    setHalfSecondsLeft(halfLengthMinutes * 60);
    setScreen("formation");
  }

  function resetCurrentGame() {
    setPlayers((currentPlayers) =>
      currentPlayers
        .filter((player) => !player.isGuest)
        .map((player) => ({ ...player, goals: 0, assists: 0, fieldTime: 0, currentFieldTime: 0, benchTime: 0, onField: false, position: "Bench" }))
    );
    setTeamGoals(0);
    setOppGoals(0);
    setRunning(false);
    setCurrentHalf(1);
    setHalfSecondsLeft(halfLengthMinutes * 60);
  }

  function deleteSavedGame(gameId) {
    const gameToDelete = games.find((game) => game.id === gameId);
    if (!gameToDelete) return;

    setGames(games.filter((game) => game.id !== gameId));

    setPlayers((currentPlayers) =>
      currentPlayers.map((player) => {
        const deletedStats = gameToDelete.players.find(
          (gamePlayer) => gamePlayer.id === player.id || gamePlayer.name === player.name
        );
        if (!deletedStats || player.isGuest) return player;
        return {
          ...player,
          seasonGoals: Math.max(0, player.seasonGoals - (deletedStats.goals || 0)),
          seasonAssists: Math.max(0, player.seasonAssists - (deletedStats.assists || 0)),
          seasonMinutes: Math.max(0, player.seasonMinutes - (deletedStats.minutes || 0)),
        };
      })
    );
  }

  function clearEverything() {
    localStorage.removeItem(storageKey);
    setPlayers([]);
    setGames([]);
    setTeamGoals(0);
    setOppGoals(0);
    setRunning(false);
  }

  function goTo(nextScreen) {
    setScreen(nextScreen);
    setMenuOpen(false);
  }

  return (
    <main className="app-shell">
      <section className="phone-shell">
        <header className="top-bar">
          <div className="top-row">
            <button onClick={() => setMenuOpen(true)} className="icon-button">☰</button>
            <div className="score-block">
              <div className="app-name">CoachBench</div>
              <div className="score">{teamGoals} - {oppGoals}</div>
            </div>
            <button onClick={() => setRunning(!running)} className={running ? "pause-button" : "start-button"}>{running ? "PAUSE" : "START"}</button>
          </div>

          <div className="timer-card">
            <div>
              <div className="timer-label">Half {currentHalf} Timer</div>
              <div className={halfSecondsLeft === 0 ? "timer-display timer-done" : "timer-display"}>{formatTime(halfSecondsLeft)}</div>
            </div>
            <div className="timer-controls">
              <select value={halfLengthMinutes} onChange={(e) => updateHalfLength(e.target.value)}>
                <option value="20">20 min</option>
                <option value="25">25 min</option>
                <option value="30">30 min</option>
                <option value="35">35 min</option>
                <option value="40">40 min</option>
                <option value="45">45 min</option>
              </select>
              <button onClick={resetHalfTimer} className="dark-button">Reset</button>
              <button onClick={nextHalf} className="dark-button">Next Half</button>
            </div>
          </div>

          <div className="quick-actions">
            <button onClick={() => setGoalPanelOpen(!goalPanelOpen)} className="blue-button">+ Our Goal</button>
            <button onClick={() => setOppGoals(oppGoals + 1)} className="dark-button">+ Opp Goal</button>
            <button onClick={saveGameToSeason} className="green-dark-button">Save Game</button>
          </div>

          {goalPanelOpen && (
            <div className="goal-panel">
              <div className="goal-select-row">
                <select value={scorerId} onChange={(e) => setScorerId(e.target.value)}>
                  <option value="">Scorer</option>
                  {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
                </select>
                <select value={assistId} onChange={(e) => setAssistId(e.target.value)}>
                  <option value="none">No Assist</option>
                  {players.filter((player) => player.id !== scorerId).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
                </select>
              </div>
              <button onClick={recordOurGoal} className="green-button full-width">Record Goal</button>
            </div>
          )}
        </header>

        <div className="main-tabs">
          <button onClick={() => setScreen("formation")} className={screen === "formation" ? "active-tab" : "tab"}>Formation</button>
          <button onClick={() => setScreen("roster")} className={screen === "roster" ? "active-tab" : "tab"}>Roster</button>
        </div>

        <section className="content-area">
          {screen === "formation" && (
            <div className="section-stack">
              <div className="formation-tools">
                <select value={format} onChange={(e) => setFormat(e.target.value)}>
                  <option>7v7</option>
                  <option>9v9</option>
                  <option>11v11</option>
                </select>
                <button onClick={() => setFieldFlipped(!fieldFlipped)} className="dark-button">Flip Field</button>
                <span className="count-pill">{onField.length}/{positions.length}</span>
              </div>

              {longestShift && (
                <div className="sub-reminder">
                  Longest shift: <strong>{longestShift.name}</strong> • {formatTime(longestShift.currentFieldTime || 0)}
                </div>
              )}

              <div className="field-card">
                <div className="field-line" />
                <div className="formation-grid">
                  {formationRows.map((row, rowIndex) => (
                    <div key={rowIndex} className="formation-row" style={{ gridTemplateColumns: `repeat(${row.length}, 1fr)` }}>
                      {row.map((position) => {
                        const assigned = players.find((p) => p.position === position && p.onField);
                        return (
                          <div key={position} className="position-card">
                            <div className="position-top">
                              <span className="position-name">{position}</span>
                              <button onClick={() => assigned && sendToBench(assigned.id)} className="time-chip">
                                {assigned ? formatTime(assigned.currentFieldTime || 0) : "Open"}
                              </button>
                            </div>
                            <select value={assigned?.id || ""} onChange={(e) => assignPlayer(e.target.value, position)} className="player-select">
                              <option value="">Player</option>
                              {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={() => goTo("bench")} className={urgentBench > 0 ? "bench-alert-button" : "bench-button"}>
                Bench / Substitutions {urgentBench > 0 ? `(${urgentBench} over 5 min)` : ""}
              </button>
            </div>
          )}

          {screen === "roster" && (
            <div className="section-stack">
              <div className="card">
                <h2>Roster</h2>
                <div className="add-row">
                  <input value={newPlayer} onChange={(e) => setNewPlayer(e.target.value)} placeholder="Permanent roster player" />
                  <button onClick={addPlayer} className="blue-button">Add</button>
                </div>
                <div className="add-row guest-row">
                  <input value={newGuestPlayer} onChange={(e) => setNewGuestPlayer(e.target.value)} placeholder="Guest for this game only" />
                  <button onClick={addGuestPlayer} className="green-dark-button">Guest</button>
                </div>
              </div>
              {players.map((player) => (
                <div key={player.id} className="list-row">
                  <div>
                    <div className="row-title">{player.name}</div>
                    <div className="row-subtitle">{player.isGuest ? "Guest player • " : ""}{player.onField ? player.position : "Bench"}</div>
                  </div>
                  <button onClick={() => deletePlayer(player.id)} className="delete-button">Delete</button>
                </div>
              ))}
            </div>
          )}

          {screen === "bench" && (
            <div className="section-stack">
              <div className="screen-heading"><h2>Bench</h2><button onClick={() => setScreen("formation")} className="dark-button">Back</button></div>
              {bench.length === 0 && <p className="card muted">No players are currently on the bench.</p>}
              {bench.map((benchPlayer) => (
                <div key={benchPlayer.id} className={benchPlayer.benchTime > 300 ? "bench-card urgent" : "bench-card"}>
                  <div className="bench-card-top">
                    <div><div className="row-title">{benchPlayer.name}</div><div className="row-subtitle">Bench {formatTime(benchPlayer.benchTime)}</div></div>
                    {benchPlayer.benchTime > 300 && <span className="sub-badge">SUB?</span>}
                  </div>
                  <select defaultValue="" onChange={(e) => { if (e.target.value) subPlayers(benchPlayer.id, e.target.value); e.target.value = ""; }}>
                    <option value="">Sub in for...</option>
                    {onField.map((fieldPlayer) => <option key={fieldPlayer.id} value={fieldPlayer.id}>{fieldPlayer.name} - {fieldPlayer.position} - shift {formatTime(fieldPlayer.currentFieldTime || 0)}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}

          {screen === "stats" && (
            <div className="section-stack">
              <div className="screen-heading"><h2>Stats</h2><button onClick={() => setScreen("formation")} className="dark-button">Back</button></div>
              <div className="card"><h3>Current Game</h3>{players.map((p) => <div key={p.id} className="stat-row"><span>{p.name}</span><span>{p.goals}G / {p.assists}A / Total {formatTime(p.fieldTime)} / Shift {formatTime(p.currentFieldTime || 0)}</span></div>)}</div>
              <div className="card"><h3>Season Totals</h3>{players.map((p) => <div key={p.id} className="stat-row"><span>{p.name}</span><span>{p.isGuest ? "Guest" : `${p.seasonGoals}G / ${p.seasonAssists}A / ${p.seasonMinutes}m`}</span></div>)}</div>
              <div className="card"><h3>Saved Games</h3>{games.length === 0 && <p className="muted">No saved games yet.</p>}{games.map((game) => (
                <div key={game.id} className="saved-game">
                  <div className="saved-game-header">
                    <strong>{game.date} | {game.format} | {game.score}</strong>
                    <button onClick={() => deleteSavedGame(game.id)} className="delete-game-button">Delete</button>
                  </div>
                  <p>{game.players.filter((p) => p.goals || p.assists).map((p) => `${p.name}: ${p.goals}G/${p.assists}A`).join(" • ") || "No player goals recorded"}</p>
                </div>
              ))}</div>
            </div>
          )}
        </section>

        {menuOpen && (
          <div className="menu-overlay" onClick={() => setMenuOpen(false)}>
            <aside className="side-menu" onClick={(e) => e.stopPropagation()}>
              <div className="menu-header"><h2>Menu</h2><button onClick={() => setMenuOpen(false)} className="dark-button">✕</button></div>
              <button onClick={() => goTo("formation")} className="menu-button">Formation</button>
              <button onClick={() => goTo("roster")} className="menu-button">Roster</button>
              <button onClick={() => goTo("bench")} className="menu-button">Bench / Substitutions {urgentBench > 0 ? `(${urgentBench})` : ""}</button>
              <button onClick={() => goTo("stats")} className="menu-button">Stats / Saved Games</button>
              <div className="menu-divider" />
              <button onClick={() => { resetCurrentGame(); setMenuOpen(false); }} className="menu-button">Reset Current Game</button>
              <button onClick={() => { clearEverything(); setMenuOpen(false); }} className="danger-menu-button">Clear All Data</button>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
