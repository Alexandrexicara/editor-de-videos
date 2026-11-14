import { useEffect, useRef, useState } from 'react';
import {
  Canvas, FabricImage, Rect, Circle, Textbox, FabricObject,
} from 'fabric';
import {
  ImagePlus, Type, Square, Circle as CircleIcon, Download, Save, Undo2, Redo2,
  Trash2, Layers3, Sparkles, LayoutTemplate, Plus, MousePointer2, Upload,
  WandSparkles, FileImage, Monitor, Smartphone, RectangleHorizontal, Check,
  FolderOpen, Loader2, ArrowUp, ArrowDown, FileDown, RotateCcw, RotateCw,
} from 'lucide-react';

type LayerItem = { id: string; label: string; object: FabricObject };
type ProjectItem = { id: string; name: string; updated_at: string };
type ExportFormat = 'png' | 'jpeg' | 'webp';

const PRESETS = [
  { name: 'Post quadrado', width: 1080, height: 1080, icon: Square },
  { name: 'Story', width: 1080, height: 1920, icon: Smartphone },
  { name: 'Banner', width: 1600, height: 900, icon: RectangleHorizontal },
];

function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const canvasEl = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const historyLockRef = useRef(false);
  const loadingProjectRef = useRef(false);

  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [selected, setSelected] = useState<FabricObject | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1080, height: 1080 });
  const [zoom, setZoom] = useState(55);
  const [projectName, setProjectName] = useState('Meu projeto');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [activeTab, setActiveTab] = useState<'design' | 'layers'>('design');
  const [background, setBackground] = useState('#ffffff');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [historyPosition, setHistoryPosition] = useState(0);
  const [historyCount, setHistoryCount] = useState(1);

  const canvas = () => canvasRef.current;

  const refresh = () => {
    const c = canvas();
    if (!c) return;
    setLayers(c.getObjects().map((object, index) => ({
      id: String(index),
      label: object.name || (object.type === 'textbox' ? 'Texto' : object.type === 'image' ? 'Imagem' : 'Forma'),
      object,
    })).reverse());
    setSelected(c.getActiveObject() || null);
    setSaved(false);
  };

  const recordHistory = (c: Canvas) => {
    if (historyLockRef.current) return;
    const snapshot = JSON.stringify(c.toJSON(['name']));
    if (historyRef.current[historyIndexRef.current] === snapshot) return;
    const next = historyRef.current.slice(0, historyIndexRef.current + 1);
    next.push(snapshot);
    if (next.length > 60) next.shift();
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
    setHistoryPosition(historyIndexRef.current);
    setHistoryCount(next.length);
  };

  useEffect(() => {
    if (!canvasEl.current || canvasRef.current) return;
    const c = new Canvas(canvasEl.current, {
      width: canvasSize.width,
      height: canvasSize.height,
      backgroundColor: background,
      preserveObjectStacking: true,
      selection: true,
    });
    canvasRef.current = c;
    const sync = () => {
      setSelected(c.getActiveObject() || null);
      setLayers(c.getObjects().map((object, index) => ({
        id: String(index),
        label: object.name || (object.type === 'textbox' ? 'Texto' : object.type === 'image' ? 'Imagem' : 'Forma'),
        object,
      })).reverse());
    };
    const changed = () => {
      sync();
      recordHistory(c);
      setSaved(false);
    };
    c.on('selection:created', sync);
    c.on('selection:updated', sync);
    c.on('selection:cleared', sync);
    c.on('object:added', changed);
    c.on('object:removed', changed);
    c.on('object:modified', changed);
    historyRef.current = [JSON.stringify(c.toJSON(['name']))];
    historyIndexRef.current = 0;
    setHistoryPosition(0);
    setHistoryCount(1);
    return () => {
      c.dispose();
      canvasRef.current = null;
    };
  }, []);

  useEffect(() => {
    void loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const response = await fetch('/api/studio/projects', { credentials: 'include' });
      if (response.status === 401) {
        setAuthRequired(true);
        return;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar seus projetos.');
      setProjects(result.projects || []);
      setAuthRequired(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao carregar projetos.');
    } finally {
      setLoadingProjects(false);
    }
  };

  const addText = () => {
    const c = canvas();
    if (!c) return;
    const text = new Textbox('Seu texto aqui', {
      left: 120, top: 150, width: 650, fontSize: 76, fontFamily: 'Arial',
      fontWeight: 'bold', fill: '#172033', editable: true, name: 'Texto',
    });
    c.add(text);
    c.setActiveObject(text);
    c.requestRenderAll();
    refresh();
  };

  const addShape = (kind: 'rect' | 'circle') => {
    const c = canvas();
    if (!c) return;
    const shape = kind === 'rect'
      ? new Rect({ left: 180, top: 180, width: 360, height: 240, rx: 28, ry: 28, fill: '#7c3aed', name: 'Retângulo' })
      : new Circle({ left: 220, top: 220, radius: 120, fill: '#f59e0b', name: 'Círculo' });
    c.add(shape);
    c.setActiveObject(shape);
    c.requestRenderAll();
    refresh();
  };

  const uploadImage = async (file?: File) => {
    const c = canvas();
    if (!c || !file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setNotice('Envie uma imagem PNG, JPG ou WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setNotice('Cada imagem pode ter no máximo 5 MB para permitir o salvamento na nuvem.');
      return;
    }
    try {
      const dataUrl = await readDataUrl(file);
      const image = await FabricImage.fromURL(dataUrl);
      const max = Math.min(760 / image.width!, 760 / image.height!, 1);
      image.scale(max);
      image.set({ left: 120, top: 120, name: file.name, cornerStyle: 'circle' });
      c.add(image);
      c.setActiveObject(image);
      c.requestRenderAll();
      refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao inserir imagem.');
    }
  };

  const removeSelected = () => {
    const c = canvas();
    const obj = c?.getActiveObject();
    if (!c || !obj) return;
    c.remove(obj);
    c.discardActiveObject();
    c.requestRenderAll();
    refresh();
  };

  const exportImage = (format: ExportFormat = exportFormat) => {
    const c = canvas();
    if (!c) return;
    c.discardActiveObject();
    c.requestRenderAll();
    const url = c.toDataURL({ format, multiplier: 1 });
    const link = document.createElement('a');
    const extension = format === 'jpeg' ? 'jpg' : format;
    link.href = url;
    link.download = (projectName.trim().replace(/[^a-z0-9-_]+/gi, '-') || 'arte') + '.' + extension;
    link.click();
  };

  const exportPdf = () => {
    const c = canvas();
    if (!c) return;
    c.discardActiveObject();
    c.requestRenderAll();
    const image = c.toDataURL({ format: 'png', multiplier: 1 });
    const popup = window.open('', '_blank');
    if (!popup) {
      setNotice('Permita a abertura da janela para imprimir ou salvar em PDF.');
      return;
    }
    popup.document.write('<!doctype html><html><head><title>' + projectName.replace(/[<>]/g, '') + '</title><style>@page{margin:0}html,body{margin:0;width:100%;height:100%}img{width:100%;height:100%;object-fit:contain}</style></head><body><img src="' + image + '" onload="window.print()"></body></html>');
    popup.document.close();
  };

  const saveProject = async (silent = false) => {
    const c = canvas();
    if (!c || saving || authRequired) return;
    setSaving(true);
    try {
      const documentData = {
        width: canvasSize.width,
        height: canvasSize.height,
        background,
        canvas: c.toJSON(['name']),
      };
      const body = JSON.stringify({ id: projectId, name: projectName.trim() || 'Projeto sem título', document: documentData });
      if (body.length > 18 * 1024 * 1024) throw new Error('O projeto ficou muito grande. Reduza o tamanho ou a quantidade de imagens.');
      const response = await fetch('/api/studio/projects', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (response.status === 401) {
        setAuthRequired(true);
        throw new Error('Entre na sua conta do Cine Séries para salvar projetos na nuvem.');
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar o projeto.');
      setProjectId(result.project.id);
      setSaved(true);
      setProjects((current) => {
        const next = current.filter((item) => item.id !== result.project.id);
        return [{ id: result.project.id, name: result.project.name, updated_at: result.project.updated_at }, ...next];
      });
      if (!silent) setNotice('Projeto salvo na sua conta.');
    } catch (error) {
      if (!silent) setNotice(error instanceof Error ? error.message : 'Falha ao salvar projeto.');
    } finally {
      setSaving(false);
    }
  };

  const loadProject = async (id: string) => {
    try {
      const response = await fetch('/api/studio/projects/' + encodeURIComponent(id), { credentials: 'include' });
      if (response.status === 401) {
        setAuthRequired(true);
        throw new Error('Entre na sua conta para abrir seus projetos.');
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível abrir o projeto.');
      const project = result.project;
      const c = canvas();
      if (!c) return;
      loadingProjectRef.current = true;
      historyLockRef.current = true;
      await c.loadFromJSON(project.document.canvas);
      c.setDimensions({ width: project.document.width, height: project.document.height });
      c.backgroundColor = project.document.background || '#ffffff';
      c.requestRenderAll();
      setCanvasSize({ width: project.document.width, height: project.document.height });
      setBackground(project.document.background || '#ffffff');
      setProjectName(project.name);
      setProjectId(project.id);
      setSaved(true);
      setShowProjects(false);
      refresh();
      historyRef.current = [JSON.stringify(c.toJSON(['name']))];
      historyIndexRef.current = 0;
      setHistoryPosition(0);
      setHistoryCount(1);
      setNotice('Projeto aberto.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao abrir projeto.');
    } finally {
      historyLockRef.current = false;
      loadingProjectRef.current = false;
    }
  };

  const deleteProject = async (id: string) => {
    if (!window.confirm('Excluir este projeto da sua nuvem?')) return;
    try {
      const response = await fetch('/api/studio/projects/' + encodeURIComponent(id), {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível excluir o projeto.');
      setProjects((current) => current.filter((item) => item.id !== id));
      if (projectId === id) {
        setProjectId(null);
        setSaved(false);
      }
      setNotice('Projeto excluído.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao excluir projeto.');
    }
  };

  const changeSize = (width: number, height: number) => {
    const c = canvas();
    if (!c) return;
    c.setDimensions({ width, height });
    setCanvasSize({ width, height });
    c.requestRenderAll();
    refresh();
  };

  const setObjectColor = (color: string) => {
    const c = canvas();
    const obj = c?.getActiveObject();
    if (!c || !obj || obj.type === 'image') return;
    obj.set('fill', color);
    c.requestRenderAll();
    refresh();
  };

  const selectLayer = (object: FabricObject) => {
    const c = canvas();
    if (!c) return;
    c.setActiveObject(object);
    c.requestRenderAll();
    setSelected(object);
  };

  const undo = async () => {
    const c = canvas();
    if (!c || historyIndexRef.current <= 0) return;
    historyLockRef.current = true;
    historyIndexRef.current -= 1;
    await c.loadFromJSON(JSON.parse(historyRef.current[historyIndexRef.current]));
    c.requestRenderAll();
    historyLockRef.current = false;
    setHistoryPosition(historyIndexRef.current);
    refresh();
  };

  const redo = async () => {
    const c = canvas();
    if (!c || historyIndexRef.current >= historyRef.current.length - 1) return;
    historyLockRef.current = true;
    historyIndexRef.current += 1;
    await c.loadFromJSON(JSON.parse(historyRef.current[historyIndexRef.current]));
    c.requestRenderAll();
    historyLockRef.current = false;
    setHistoryPosition(historyIndexRef.current);
    refresh();
  };

  const applyTemplate = (kind: 'sale' | 'event' | 'product') => {
    const c = canvas();
    if (!c) return;
    c.clear();
    if (kind === 'sale') {
      c.backgroundColor = '#17112b';
      c.add(new Rect({ left: 45, top: 45, width: canvasSize.width - 90, height: canvasSize.height - 90, rx: 42, ry: 42, fill: '#2c1b4d', stroke: '#f4b942', strokeWidth: 8, name: 'Moldura da oferta' }));
      c.add(new Textbox('OFERTA ESPECIAL', { left: 100, top: 190, width: canvasSize.width - 200, fontSize: 82, fontWeight: 'bold', textAlign: 'center', fill: '#ffd166', name: 'Título da oferta' }));
      c.add(new Textbox('ATÉ 50% OFF', { left: 100, top: 390, width: canvasSize.width - 200, fontSize: 105, fontWeight: 'bold', textAlign: 'center', fill: '#ffffff', name: 'Desconto' }));
      c.add(new Textbox('Aproveite por tempo limitado', { left: 100, top: 560, width: canvasSize.width - 200, fontSize: 38, textAlign: 'center', fill: '#e9d8ff', name: 'Legenda' }));
    } else if (kind === 'event') {
      c.backgroundColor = '#092b35';
      c.add(new Rect({ left: 45, top: 45, width: canvasSize.width - 90, height: canvasSize.height - 90, rx: 36, ry: 36, fill: '#0f4c5c', stroke: '#8de3d2', strokeWidth: 6, name: 'Moldura do evento' }));
      c.add(new Textbox('VOCÊ É NOSSO CONVIDADO', { left: 100, top: 210, width: canvasSize.width - 200, fontSize: 55, fontWeight: 'bold', textAlign: 'center', fill: '#ffffff', name: 'Título do evento' }));
      c.add(new Textbox('NOME DO EVENTO', { left: 100, top: 390, width: canvasSize.width - 200, fontSize: 84, fontWeight: 'bold', textAlign: 'center', fill: '#8de3d2', name: 'Nome do evento' }));
      c.add(new Textbox('Data • Horário • Local', { left: 100, top: 590, width: canvasSize.width - 200, fontSize: 36, textAlign: 'center', fill: '#ffffff', name: 'Informações' }));
    } else {
      c.backgroundColor = '#f4f0e8';
      c.add(new Rect({ left: 50, top: 50, width: canvasSize.width - 100, height: canvasSize.height - 100, rx: 28, ry: 28, fill: '#ffffff', stroke: '#d8c7a5', strokeWidth: 5, name: 'Cartão do produto' }));
      c.add(new Textbox('DESTAQUE DA SEMANA', { left: 100, top: 130, width: canvasSize.width - 200, fontSize: 52, fontWeight: 'bold', textAlign: 'center', fill: '#4b3b2a', name: 'Chamada' }));
      c.add(new Textbox('NOME DO PRODUTO', { left: 100, top: 390, width: canvasSize.width - 200, fontSize: 74, fontWeight: 'bold', textAlign: 'center', fill: '#9b5d2e', name: 'Produto' }));
      c.add(new Textbox('Descrição • Preço • Contato', { left: 100, top: 620, width: canvasSize.width - 200, fontSize: 32, textAlign: 'center', fill: '#4b3b2a', name: 'Detalhes' }));
    }
    c.requestRenderAll();
    refresh();
  };

  const runAiEdit = async (preset?: string) => {
    const c = canvas();
    if (!c || aiBusy) return;
    const prompt = (preset || aiPrompt).trim();
    if (!prompt) {
      setNotice('Escreva o que deseja criar ou alterar com IA.');
      return;
    }
    const active = c.getActiveObject() as any;
    const reference = active?.type === 'image' ? (active.getSrc?.() || active.src) : null;
    const referenceImages = typeof reference === 'string' && reference.startsWith('data:image/') ? [reference] : [];
    setAiBusy(true);
    try {
      const response = await fetch('/api/cine/image', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, referenceImages }),
      });
      if (response.status === 401) {
        setAuthRequired(true);
        throw new Error('Entre na sua conta do Cine Séries para usar a IA.');
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'A geração de imagem falhou.');
      const image = await FabricImage.fromURL(result.image);
      const max = Math.min((canvasSize.width * 0.72) / image.width!, (canvasSize.height * 0.72) / image.height!, 1);
      image.scale(max);
      image.set({ left: Math.max(20, (canvasSize.width - image.getScaledWidth()) / 2), top: Math.max(20, (canvasSize.height - image.getScaledHeight()) / 2), name: 'Imagem criada com IA' });
      c.add(image);
      c.setActiveObject(image);
      c.requestRenderAll();
      refresh();
      setAiPrompt('');
      setNotice('Imagem criada pela NVIDIA e adicionada à arte.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível gerar a imagem.');
    } finally {
      setAiBusy(false);
    }
  };

  useEffect(() => {
    if (!projectId || authRequired || loadingProjectRef.current || saved) return;
    const timer = window.setTimeout(() => { void saveProject(true); }, 1800);
    return () => window.clearTimeout(timer);
  }, [layers, projectName, background, canvasSize, projectId, authRequired, saved]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><Sparkles size={19}/></div><div><strong>Studio Criativo <span>AI</span></strong><small>Dentro do Cine Séries</small></div></div>
        <div className="project-title"><input value={projectName} onChange={e => { setProjectName(e.target.value); setSaved(false); }} aria-label="Nome do projeto"/><span className="status">{saving ? <><Loader2 size={13}/> Salvando</> : saved ? <><Check size={13}/> Salvo na nuvem</> : 'Alterações não salvas'}</span></div>
        <div className="top-actions">
          <button className="btn subtle" onClick={() => { setShowProjects(v => !v); void loadProjects(); }}><FolderOpen size={16}/> <span>Meus projetos</span></button>
          <button className="btn subtle" onClick={() => void saveProject()} disabled={saving}><Save size={16}/> <span>Salvar</span></button>
          <select className="export-select" value={exportFormat} onChange={e => setExportFormat(e.target.value as ExportFormat)} aria-label="Formato de exportação"><option value="png">PNG</option><option value="jpeg">JPG</option><option value="webp">WebP</option></select>
          <button className="btn primary" onClick={() => exportImage()}><Download size={16}/> Exportar</button>
          <button className="btn subtle" onClick={exportPdf} title="Imprimir ou salvar em PDF"><FileDown size={16}/></button>
        </div>
      </header>

      {authRequired && <div className="auth-warning">Para salvar projetos e usar a IA, <a href="/login.html?next=/studio-criativo/">entre na sua conta do Cine Séries</a>.</div>}
      {showProjects && <div className="projects-popover"><div className="projects-head"><b>Seus projetos na nuvem</b><button onClick={() => setShowProjects(false)}>×</button></div>{loadingProjects ? <p>Carregando...</p> : projects.length === 0 ? <p>Nenhum projeto salvo ainda. Crie sua arte e clique em Salvar.</p> : projects.map(item => <div className="project-row" key={item.id}><button className="project-open" onClick={() => void loadProject(item.id)}><b>{item.name}</b><small>{new Date(item.updated_at).toLocaleString('pt-BR')}</small></button><button className="project-delete" onClick={() => void deleteProject(item.id)} title="Excluir projeto">×</button></div>)}</div>}

      <main className="workspace">
        <aside className="leftbar">
          <div className="side-tabs"><button className={activeTab === 'design' ? 'active' : ''} onClick={() => setActiveTab('design')}><LayoutTemplate size={18}/> Design</button><button className={activeTab === 'layers' ? 'active' : ''} onClick={() => setActiveTab('layers')}><Layers3 size={18}/> Camadas</button></div>
          {activeTab === 'design' ? <div className="tool-panel">
            <div className="panel-heading">Adicionar elementos</div>
            <button className="tool-card" onClick={() => fileRef.current?.click()}><span className="tool-icon violet"><ImagePlus/></span><span><b>Enviar imagem</b><small>PNG, JPG ou WebP • até 5 MB</small></span><Plus size={16}/></button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { void uploadImage(e.target.files?.[0]); e.currentTarget.value = ''; }}/>
            <button className="tool-card" onClick={addText}><span className="tool-icon blue"><Type/></span><span><b>Adicionar texto</b><small>Títulos e legendas editáveis</small></span><Plus size={16}/></button>
            <div className="tool-grid"><button onClick={() => addShape('rect')}><Square/><span>Retângulo</span></button><button onClick={() => addShape('circle')}><CircleIcon/><span>Círculo</span></button></div>
            <div className="panel-heading space-top">Tamanho da arte</div>
            <div className="preset-list">{PRESETS.map(p => <button key={p.name} className={canvasSize.width === p.width && canvasSize.height === p.height ? 'preset active' : 'preset'} onClick={() => changeSize(p.width,p.height)}><p.icon size={17}/><span>{p.name}</span><small>{p.width} × {p.height}</small></button>)}</div>
            <div className="panel-heading space-top">Modelos rápidos</div>
            <div className="template-list"><button onClick={() => applyTemplate('sale')}>Oferta / promoção</button><button onClick={() => applyTemplate('event')}>Evento / convite</button><button onClick={() => applyTemplate('product')}>Produto / vitrine</button></div>
            <div className="panel-heading space-top">Fundo da página</div>
            <div className="color-row"><input type="color" value={background} onChange={e => {setBackground(e.target.value); canvas()?.set('backgroundColor',e.target.value); canvas()?.requestRenderAll(); setSaved(false);}}/><span>{background.toUpperCase()}</span></div>
            <div className="panel-heading space-top">Criar e editar com IA</div>
            <div className="ai-tools"><textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Descreva a imagem que deseja criar ou como quer transformar a imagem selecionada..."/><button className="ai-primary" disabled={aiBusy} onClick={() => void runAiEdit()}>{aiBusy ? <><Loader2 size={14}/> Gerando...</> : <><WandSparkles size={14}/> Gerar / editar imagem</>}</button><button onClick={() => void runAiEdit('Crie uma arte publicitária profissional, limpa e de alta qualidade, com composição equilibrada e sem textos legíveis.')}>Criar arte publicitária</button><button onClick={() => void runAiEdit('Substitua o fundo da imagem por um cenário de estúdio profissional, mantenha o objeto principal fiel e com iluminação natural.')}>Trocar fundo da imagem selecionada</button><small>Usa a IA NVIDIA já integrada ao Cine Séries. A imagem selecionada vira referência para edição.</small></div>
          </div> : <div className="tool-panel"><div className="panel-heading">Camadas do projeto</div>{layers.length === 0 ? <div className="empty-layers">Seus elementos aparecerão aqui quando você adicionar textos, formas ou imagens.</div> : layers.map((layer,i) => <button key={layer.id} className={selected === layer.object ? 'layer active' : 'layer'} onClick={() => selectLayer(layer.object)}><span>{layer.object.type === 'image' ? <FileImage size={16}/> : layer.object.type === 'textbox' ? <Type size={16}/> : <Square size={16}/>}</span>{layer.label || 'Elemento'}<small>{layers.length-i}</small></button>)}</div>}
          <div className="sidebar-bottom"><div className="ai-card"><div className="ai-icon"><WandSparkles size={18}/></div><b>IA conectada ao Cine Séries</b><p>Crie imagens do zero ou use uma imagem selecionada como referência para transformar a arte.</p><span>NVIDIA NIM</span></div></div>
        </aside>

        <section className="editor-area">
          <div className="editor-toolbar"><div className="crumb"><span>Meus projetos</span><b>/</b><strong>{projectName || 'Sem título'}</strong></div><div className="canvas-actions"><button title="Desfazer" onClick={() => void undo()} disabled={historyPosition <= 0}><Undo2 size={17}/></button><button title="Refazer" onClick={() => void redo()} disabled={historyPosition >= historyCount - 1}><Redo2 size={17}/></button><i></i><button title="Enviar camada para frente" onClick={() => {const c=canvas();const o=c?.getActiveObject();if(c&&o){c.bringObjectForward(o);c.requestRenderAll();refresh();}}}><ArrowUp size={17}/></button><button title="Enviar camada para trás" onClick={() => {const c=canvas();const o=c?.getActiveObject();if(c&&o){c.sendObjectBackwards(o);c.requestRenderAll();refresh();}}}><ArrowDown size={17}/></button><i></i><button title="Excluir selecionado" onClick={removeSelected}><Trash2 size={17}/></button></div></div>
          <div className="canvas-stage">
            <div className="canvas-wrap" style={{width: canvasSize.width * zoom / 100, height: canvasSize.height * zoom / 100, ['--canvas-scale' as any]: zoom / 100}}><canvas ref={canvasEl}/></div>
            {layers.length === 0 && <div className="canvas-hint"><div className="hint-icon"><Upload size={22}/></div><b>Comece sua criação</b><p>Envie uma foto, escolha um modelo ou adicione um texto para montar sua arte.</p><button className="btn primary" onClick={() => fileRef.current?.click()}><ImagePlus size={16}/> Enviar primeira imagem</button></div>}
          </div>
          <div className="bottom-toolbar"><div><Monitor size={15}/><span>{canvasSize.width} × {canvasSize.height} px</span></div><div className="zoom-control"><button onClick={() => setZoom(z => Math.max(20,z-5))}>−</button><span>{zoom}%</span><button onClick={() => setZoom(z => Math.min(100,z+5))}>+</button></div></div>
        </section>

        <aside className="rightbar"><div className="right-heading"><b>Propriedades</b><RotateCcw size={17}/></div>{selected ? <div className="properties"><p className="property-label">Elemento selecionado</p><div className="selected-name">{selected.name || (selected.type === 'textbox' ? 'Texto' : selected.type === 'image' ? 'Imagem' : 'Forma')}</div>{selected.type !== 'image' && <><div className="property-label">Cor do elemento</div><div className="color-row"><input type="color" value={typeof selected.fill === 'string' && selected.fill.startsWith('#') ? selected.fill : '#7c3aed'} onChange={e => setObjectColor(e.target.value)}/><span>{String(selected.fill || '').toUpperCase()}</span></div></>}<div className="property-label">Opacidade</div><input className="range-control" type="range" min="0.1" max="1" step="0.05" value={Number(selected.opacity ?? 1)} onChange={e => {selected.set('opacity',Number(e.target.value));canvas()?.requestRenderAll();refresh();}}/><div className="property-label">Rotação</div><input className="range-control" type="range" min="-180" max="180" value={Math.round(selected.angle || 0)} onChange={e => {selected.set('angle',Number(e.target.value));canvas()?.requestRenderAll();refresh();}}/><div className="property-label">Posição</div><div className="property-grid"><label>X<input type="number" value={Math.round(selected.left || 0)} onChange={e => {selected.set('left',Number(e.target.value));canvas()?.requestRenderAll();refresh();}}/></label><label>Y<input type="number" value={Math.round(selected.top || 0)} onChange={e => {selected.set('top',Number(e.target.value));canvas()?.requestRenderAll();refresh();}}/></label></div>{selected.type === 'textbox' && <><div className="property-label">Tamanho da fonte</div><input className="property-number" type="number" min="8" max="240" value={Math.round((selected as Textbox).fontSize || 24)} onChange={e => {(selected as Textbox).set('fontSize',Number(e.target.value));canvas()?.requestRenderAll();refresh();}}/><div className="property-label">Fonte</div><select className="property-select" value={(selected as Textbox).fontFamily || 'Arial'} onChange={e => {(selected as Textbox).set('fontFamily',e.target.value);canvas()?.requestRenderAll();refresh();}}><option>Arial</option><option>Georgia</option><option>Impact</option><option>Verdana</option><option>Trebuchet MS</option></select></>}<div className="property-actions"><button onClick={() => {selected.rotate((selected.angle || 0)-90);canvas()?.requestRenderAll();refresh();}}><RotateCcw size={14}/> -90°</button><button onClick={() => {selected.rotate((selected.angle || 0)+90);canvas()?.requestRenderAll();refresh();}}><RotateCw size={14}/> +90°</button></div><button className="delete-button" onClick={removeSelected}><Trash2 size={15}/> Excluir elemento</button></div> : <div className="no-selection"><MousePointer2 size={24}/><b>Nenhum elemento selecionado</b><p>Selecione um item na arte para editar cor, tamanho, posição, rotação e transparência.</p></div>}
          <div className="right-footer"><Sparkles size={15}/> Edição visual • IA • projetos na nuvem</div></aside>
      </main>
      {notice && <button className="toast show" onClick={() => setNotice('')}>{notice} <span>×</span></button>}
    </div>
  );
}
