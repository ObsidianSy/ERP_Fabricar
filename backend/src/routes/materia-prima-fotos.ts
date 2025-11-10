import express, { Request, Response } from 'express';
import multer from 'multer';
import { pool } from '../database/db';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configurar multer para upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/fotos-materias-primas');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'mp-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo não permitido. Use apenas JPG, PNG ou WEBP.'));
        }
    }
});

// GET /api/materia-prima-fotos - Lista matérias-primas com suas fotos
router.get('/', async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT 
                mpf.sku_mp,
                mpf.foto_url,
                mpf.foto_filename,
                mpf.foto_size,
                mpf.created_at,
                mpf.updated_at,
                mp.nome,
                mp.categoria
            FROM obsidian.materia_prima_fotos mpf
            JOIN obsidian.materia_prima mp ON mp.sku_mp = mpf.sku_mp
            ORDER BY mpf.sku_mp
        `);

        res.json(result.rows);
    } catch (error: any) {
        console.error('Erro ao listar matérias-primas com fotos:', error);
        res.status(500).json({ error: 'Erro ao listar matérias-primas com fotos' });
    }
});

// GET /api/materia-prima-fotos/:sku/thumbnail - Retorna a foto de uma matéria-prima
router.get('/:sku/thumbnail', async (req: Request, res: Response) => {
    try {
        const { sku } = req.params;
        const skuUpper = decodeURIComponent(sku).toUpperCase();

        console.log(`📸 Buscando foto para SKU: ${skuUpper}`);

        const result = await pool.query(`
            SELECT foto_filename 
            FROM obsidian.materia_prima_fotos 
            WHERE UPPER(sku_mp) = $1
        `, [skuUpper]);

        if (result.rows.length === 0) {
            console.log(`❌ Foto não encontrada para SKU: ${skuUpper}`);
            // Retornar imagem placeholder se não tiver foto
            return res.status(404).json({ error: 'Foto não encontrada' });
        }

        const filePath = path.join(__dirname, '../../uploads/fotos-materias-primas', result.rows[0].foto_filename);

        console.log(`✅ Foto encontrada: ${result.rows[0].foto_filename}`);
        console.log(`📂 Caminho: ${filePath}`);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Arquivo de foto não encontrado' });
        }

        res.sendFile(filePath);
    } catch (error: any) {
        console.error('Erro ao buscar foto:', error);
        res.status(500).json({ error: 'Erro ao buscar foto' });
    }
});

// POST /api/materia-prima-fotos - Upload de foto para matéria-prima
router.post('/', upload.single('foto'), async (req: Request, res: Response) => {
    try {
        const { sku_mp } = req.body;
        const file = req.file;

        if (!sku_mp) {
            return res.status(400).json({ error: 'sku_mp é obrigatório' });
        }

        if (!file) {
            return res.status(400).json({ error: 'Arquivo de foto é obrigatório' });
        }

        // Construir URL da foto (relativo ao servidor)
        const foto_url = `/uploads/fotos-materias-primas/${file.filename}`;

        // Verificar se matéria-prima existe
        const checkMP = await pool.query(`
            SELECT COUNT(*) as total
            FROM obsidian.materia_prima
            WHERE UPPER(sku_mp) = $1
        `, [sku_mp.toUpperCase()]);

        if (parseInt(checkMP.rows[0].total) === 0) {
            // Remover arquivo se matéria-prima não existe
            fs.unlinkSync(file.path);
            return res.status(404).json({ error: 'Matéria-prima não encontrada' });
        }

        // Inserir ou atualizar foto
        const result = await pool.query(`
            INSERT INTO obsidian.materia_prima_fotos (sku_mp, foto_url, foto_filename, foto_size)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (sku_mp) 
            DO UPDATE SET 
                foto_url = EXCLUDED.foto_url,
                foto_filename = EXCLUDED.foto_filename,
                foto_size = EXCLUDED.foto_size,
                updated_at = NOW()
            RETURNING *
        `, [sku_mp.toUpperCase(), foto_url, file.filename, file.size]);

        res.json({
            message: 'Foto enviada com sucesso',
            foto: result.rows[0]
        });
    } catch (error: any) {
        console.error('Erro ao fazer upload de foto:', error);
        res.status(500).json({ error: 'Erro ao fazer upload de foto' });
    }
});

// DELETE /api/materia-prima-fotos/:sku - Remove foto de matéria-prima
router.delete('/:sku', async (req: Request, res: Response) => {
    try {
        const { sku } = req.params;
        const skuUpper = decodeURIComponent(sku).toUpperCase();

        // Buscar informações da foto antes de deletar
        const foto = await pool.query(`
            SELECT foto_filename 
            FROM obsidian.materia_prima_fotos 
            WHERE UPPER(sku_mp) = $1
        `, [skuUpper]);

        if (foto.rows.length === 0) {
            return res.status(404).json({ error: 'Foto não encontrada' });
        }

        // Deletar registro do banco
        await pool.query(`
            DELETE FROM obsidian.materia_prima_fotos 
            WHERE UPPER(sku_mp) = $1
        `, [skuUpper]);

        // Remover arquivo físico
        const filePath = path.join(__dirname, '../../uploads/fotos-materias-primas', foto.rows[0].foto_filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.json({ message: 'Foto removida com sucesso' });
    } catch (error: any) {
        console.error('Erro ao remover foto:', error);
        res.status(500).json({ error: 'Erro ao remover foto' });
    }
});

export default router;
