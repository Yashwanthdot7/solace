import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const box = "p-6 border border-[#1A1A1A] rounded-sm";
const input = "w-full bg-transparent border border-[#333] rounded-sm px-4 py-3 outline-none focus:border-[#C8F04B]";
const btn = "bg-[#C8F04B] text-black px-4 py-2 label-mono hover:bg-white transition disabled:opacity-40";
const ghost = "border border-[#333] text-[#A0A0A0] px-3 py-1.5 label-mono hover:text-white hover:border-white/40 transition";

export default function Settings() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [guardians, setGuardians] = useState([]);
  const [invites, setInvites] = useState([]);
  const [email, setEmail] = useState("");
  const [shareMoods, setShareMoods] = useState(false);
  const [alertOnCrisis, setAlertOnCrisis] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = () => {
    api.get("/me/guardians").then((r) => setGuardians(r.data)).catch(() => {});
    api.get("/guardian/invites").then((r) => setInvites(r.data)).catch(() => {});
  };
  useEffect(load, []);

  const err = (e, fallback) => toast.error(e.response?.data?.detail || fallback);

  const invite = async () => {
    try {
      await api.post("/guardian/invite", {
        guardian_email: email.trim(),
        share_level: shareMoods ? "moods" : "summary",
        alert_on_crisis: alertOnCrisis,
      });
      toast.success("Invitation sent. They need to accept before they see anything.");
      setEmail(""); setShareMoods(false); setAlertOnCrisis(false);
      load();
    } catch (e) { err(e, "Could not send the invitation."); }
  };

  const update = async (id, changes) => {
    try { await api.patch(`/guardian/links/${id}`, changes); load(); }
    catch (e) { err(e, "Could not update."); }
  };

  const revoke = async (id) => {
    try { await api.post(`/guardian/revoke/${id}`); toast.success("Done. They no longer have access."); load(); }
    catch (e) { err(e, "Could not remove access."); }
  };

  const accept = async (id) => {
    try { await api.post(`/guardian/accept/${id}`); toast.success("Accepted."); load(); }
    catch (e) { err(e, "Could not accept."); }
  };

  const exportData = async () => {
    try {
      const r = await api.get("/me/export");
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "solace-my-data.json"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { err(e, "Could not export your data."); }
  };

  const deleteAccount = async () => {
    try {
      await api.delete("/me", { data: { password: deletePw } });
      logout();
      toast.success("Your account and data have been deleted.");
      nav("/");
    } catch (e) { err(e, "Could not delete your account."); }
  };

  return (
    <div className="px-6 md:px-12 py-12 max-w-4xl mx-auto space-y-8">
      <div>
        <p className="label-mono text-[#A0A0A0]">/ settings · {user?.email}</p>
        <h1 className="font-display text-6xl md:text-7xl mt-2">YOUR PRIVACY.</h1>
      </div>

      {/* Who can see my wellbeing */}
      <section className={box} data-testid="settings-guardians">
        <h2 className="font-display text-3xl mb-2">Who can see my wellbeing</h2>
        <p className="text-[#A0A0A0] text-sm mb-5">
          A guardian you invite sees a short summary: your wellbeing score and how active you've been.
          <strong className="text-white"> They never see your journal, your chats with Mitra, or what you write in posts.</strong>{" "}
          You can stop sharing at any time.
        </p>

        {guardians.length === 0 && <p className="text-sm text-[#666] mb-4">You haven't invited anyone yet.</p>}
        <div className="space-y-3 mb-6">
          {guardians.map((g) => (
            <div key={g.id} className="p-4 border border-[#222] rounded-sm" data-testid="guardian-link-row">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p>{g.guardian_email}</p>
                  <p className="label-mono text-xs" style={{ color: g.status === "active" ? "#8BBF7A" : "#E8854A" }}>
                    {g.status === "active" ? "Can see your summary" : "Invited, waiting for them to accept"}
                  </p>
                </div>
                <button className={ghost} onClick={() => revoke(g.id)} data-testid="guardian-revoke-btn">
                  {g.status === "active" ? "Stop sharing" : "Cancel invite"}
                </button>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={g.share_level === "moods"}
                    onChange={(e) => update(g.id, { share_level: e.target.checked ? "moods" : "summary" })} />
                  Also share my mood labels (for example "calm" or "heavy")
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!g.alert_on_crisis}
                    onChange={(e) => update(g.id, { alert_on_crisis: e.target.checked })} />
                  Email them if I seem to be in crisis (they won't see what I wrote)
                </label>
              </div>
            </div>
          ))}
        </div>

        <p className="label-mono text-[#A0A0A0] mb-2">/ invite a guardian</p>
        <input className={input} type="email" placeholder="their.email@example.com" value={email}
          onChange={(e) => setEmail(e.target.value)} data-testid="guardian-invite-email" />
        <div className="mt-3 space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={shareMoods} onChange={(e) => setShareMoods(e.target.checked)} />
            Also share my mood labels
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={alertOnCrisis} onChange={(e) => setAlertOnCrisis(e.target.checked)} />
            Email them if I seem to be in crisis
          </label>
        </div>
        <button className={`${btn} mt-4`} disabled={!email.includes("@")} onClick={invite} data-testid="guardian-invite-btn">
          Send invitation
        </button>
      </section>

      {/* Invitations to me */}
      <section className={box} data-testid="settings-invites">
        <h2 className="font-display text-3xl mb-2">People who asked you to be their guardian</h2>
        {invites.length === 0 && <p className="text-sm text-[#666]">No invitations right now.</p>}
        {invites.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3 border-t border-[#1A1A1A]">
            <p>{i.member_name || "Someone"} invited you</p>
            <div className="flex gap-2">
              <button className={btn} onClick={() => accept(i.id)} data-testid="invite-accept-btn">Accept</button>
              <button className={ghost} onClick={() => revoke(i.id)}>Decline</button>
            </div>
          </div>
        ))}
      </section>

      {/* Data */}
      <section className={box} data-testid="settings-data">
        <h2 className="font-display text-3xl mb-2">Your data</h2>
        <p className="text-sm text-[#A0A0A0] mb-4">
          Read how we use your data in the <Link to="/privacy" className="underline text-white">privacy policy</Link>.
        </p>
        <button className={ghost} onClick={exportData} data-testid="export-data-btn">Download all my data</button>

        <div className="mt-8 pt-6 border-t border-[#1A1A1A]">
          <p className="font-semibold text-[#F2A68A]">Delete my account</p>
          <p className="text-sm text-[#A0A0A0] mt-1 mb-3">
            This permanently deletes your account, journal, chats, posts and guardian links. It cannot be undone.
          </p>
          {!confirmDelete ? (
            <button className="border border-[#F2A68A]/50 text-[#F2A68A] px-3 py-1.5 label-mono" onClick={() => setConfirmDelete(true)}
              data-testid="delete-account-btn">
              Delete my account…
            </button>
          ) : (
            <div className="space-y-3 max-w-sm">
              <input className={input} type="password" placeholder="Type your password to confirm" value={deletePw}
                onChange={(e) => setDeletePw(e.target.value)} data-testid="delete-password" />
              <div className="flex gap-2">
                <button className="bg-[#F2A68A] text-black px-4 py-2 label-mono disabled:opacity-40" disabled={!deletePw}
                  onClick={deleteAccount} data-testid="delete-confirm-btn">Delete forever</button>
                <button className={ghost} onClick={() => { setConfirmDelete(false); setDeletePw(""); }}>Keep my account</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
