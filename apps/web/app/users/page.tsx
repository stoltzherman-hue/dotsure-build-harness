"use client"
import { useState } from "react"

const roles = ["Business owner","Developer","Product owner","Compliance","Security","Architect","Finance reviewer","Auditor","Executive","Administrator"]
const depts = ["Claims","Sales","Operations","Product","Technology","Finance","Compliance","Security"]

interface User { name:string; email:string; dept:string; role:string }

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [form, setForm] = useState({name:"",email:"",dept:"",role:"Business owner"})
  const [showForm, setShowForm] = useState(false)

  const save = () => {
    if(!form.name||!form.email){alert("Name and email required");return}
    setUsers(u=>[...u,{...form}])
    setForm({name:"",email:"",dept:"",role:"Business owner"})
    setShowForm(false)
  }

  const roleBadge = (r: string) => {
    if(["Executive","Administrator"].includes(r)) return "badge-critical"
    if(["Compliance","Security"].includes(r)) return "badge-warn"
    if(["Architect","Auditor"].includes(r)) return "badge-org"
    return "badge-pur"
  }

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>Users &amp; roles</h1><p>Manage platform access and role assignments</p></div>
        <button className="btn btn-org" onClick={()=>setShowForm(s=>!s)}>+ Add user</button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-head"><h3>Add user</h3><button className="btn btn-ghost btn-sm" onClick={()=>setShowForm(false)}>Cancel</button></div>
          <div className="card-body">
            <div className="form-row" style={{marginBottom:12}}>
              <div className="form-group" style={{margin:0}}><label className="form-label">Full name *</label><input className="form-input" placeholder="Full name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
              <div className="form-group" style={{margin:0}}><label className="form-label">Email *</label><input className="form-input" placeholder="name@dotsure.co.za" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
            </div>
            <div className="form-row" style={{marginBottom:14}}>
              <div className="form-group" style={{margin:0}}><label className="form-label">Department</label>
                <select className="form-input" value={form.dept} onChange={e=>setForm(f=>({...f,dept:e.target.value}))}>
                  <option value="">Select</option>{depts.map(d=><option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group" style={{margin:0}}><label className="form-label">Role</label>
                <select className="form-input" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                  {roles.map(r=><option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end"}}><button className="btn btn-org" onClick={save}>Add user</button></div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head"><h3>Platform users</h3><span style={{fontSize:11,color:"var(--g500)"}}>{users.length} users</span></div>
        {users.length === 0 ? <div className="empty">No users added yet - users are provisioned via Azure AD in production</div> : (
          <>
            <div className="tbl-head" style={{gridTemplateColumns:"1fr 180px 110px 80px"}}>
              <span>Name</span><span>Email</span><span>Role</span><span>Status</span>
            </div>
            {users.map((u,i)=>(
              <div key={i} className="tbl-row" style={{gridTemplateColumns:"1fr 180px 110px 80px"}}>
                <div>
                  <div style={{fontWeight:600,color:"var(--g900)"}}>{u.name}</div>
                  <div style={{fontSize:10,color:"var(--g500)"}}>{u.dept}</div>
                </div>
                <span style={{fontSize:11,color:"var(--g500)"}}>{u.email}</span>
                <span><span className={"badge "+roleBadge(u.role)}>{u.role}</span></span>
                <span><span className="badge badge-ok">Active</span></span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
