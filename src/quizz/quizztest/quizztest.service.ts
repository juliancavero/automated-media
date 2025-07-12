import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QuizzTest, QuizzTestDocument } from './schemas/quizztest.schema';
import {
  Pregunta,
  PreguntaDocument,
} from '../pregunta/schemas/pregunta.schema';
import { CreateQuizzTestDto } from './dto/create-quizztest.dto';
import { UpdateQuizzTestDto } from './dto/update-quizztest.dto';

@Injectable()
export class QuizzTestService {
  constructor(
    @InjectModel(QuizzTest.name)
    private readonly quizzTestModel: Model<QuizzTestDocument>,
    @InjectModel(Pregunta.name)
    private readonly preguntaModel: Model<PreguntaDocument>,
  ) {}

  async create(createQuizzTestDto: CreateQuizzTestDto): Promise<QuizzTest> {
    const createdQuizzTest = new this.quizzTestModel(createQuizzTestDto);
    return createdQuizzTest.save();
  }

  async findAll(): Promise<QuizzTest[]> {
    return this.quizzTestModel.find().exec();
  }

  async findOne(id: string): Promise<QuizzTest> {
    const quizzTest = await this.quizzTestModel
      .findById(id)
      .populate('preguntas')
      .exec();

    if (!quizzTest) {
      throw new NotFoundException(`QuizzTest con ID ${id} no encontrado`);
    }
    return quizzTest;
  }

  async update(
    id: string,
    updateQuizzTestDto: UpdateQuizzTestDto,
  ): Promise<QuizzTest> {
    const updatedQuizzTest = await this.quizzTestModel
      .findByIdAndUpdate(id, updateQuizzTestDto, { new: true })
      .exec();

    if (!updatedQuizzTest) {
      throw new NotFoundException(`QuizzTest con ID ${id} no encontrado`);
    }

    return updatedQuizzTest;
  }

  async updateWithQuestions(
    id: string,
    updateQuizzWithQuestionsDto: any,
  ): Promise<QuizzTest> {
    const { titulo, difficulty, difficultyText, scores, preguntas } =
      updateQuizzWithQuestionsDto;

    // Find existing quiz
    const existingQuiz = await this.quizzTestModel.findById(id).exec();
    if (!existingQuiz) {
      throw new NotFoundException(`QuizzTest con ID ${id} no encontrado`);
    }

    // Handle questions update
    if (preguntas && preguntas.length > 0) {
      // Delete old questions
      await this.preguntaModel
        .deleteMany({ _id: { $in: existingQuiz.preguntas } })
        .exec();

      // Create new questions
      const createdQuestions = await this.preguntaModel.insertMany(
        preguntas.map(({ _id, ...question }) => question),
      );
      const questionIds = createdQuestions.map((q) => q._id);

      // Update quiz with new questions
      await this.quizzTestModel
        .findByIdAndUpdate(
          id,
          {
            titulo,
            difficulty: difficulty ?? existingQuiz.difficulty,
            difficultyText,
            scores: scores ?? existingQuiz.scores,
            preguntas: questionIds,
          },
          { new: true },
        )
        .exec();

      return this.findOne(id);
    } else {
      // Update only quiz properties without questions
      await this.quizzTestModel
        .findByIdAndUpdate(
          id,
          {
            titulo,
            difficulty,
            difficultyText,
            scores,
          },
          { new: true },
        )
        .exec();

      return this.findOne(id);
    }
  }

  async remove(id: string): Promise<void> {
    // Find the quiz to get associated questions
    const quizzTest = await this.quizzTestModel.findById(id).exec();
    if (!quizzTest) {
      throw new NotFoundException(`QuizzTest con ID ${id} no encontrado`);
    }

    // Delete associated questions first
    await this.preguntaModel
      .deleteMany({ _id: { $in: quizzTest.preguntas } })
      .exec();

    // Delete the quiz
    const result = await this.quizzTestModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`QuizzTest con ID ${id} no encontrado`);
    }
  }

  async createWithQuestions(createQuizzWithQuestionsDto: any) {
    const { titulo, difficulty, difficultyText, scores, preguntas } =
      createQuizzWithQuestionsDto;

    // Create questions first
    const createdQuestions = await this.preguntaModel.insertMany(preguntas);
    const questionIds = createdQuestions.map((q) => q._id);

    // Create quiz with question references
    const quizzTest = new this.quizzTestModel({
      titulo,
      difficulty: difficulty ?? 'medium',
      difficultyText,
      scores: scores ?? [],
      preguntas: questionIds,
    });

    const savedQuiz: QuizzTestDocument = await quizzTest.save();

    // Return populated quiz
    return this.findOne(String(savedQuiz._id));
  }

  async addScore(id: string, score: string): Promise<QuizzTest> {
    const quizzTest = await this.quizzTestModel.findById(id).exec();

    if (!quizzTest) {
      throw new NotFoundException(`QuizzTest con ID ${id} no encontrado`);
    }

    if (!quizzTest.scores.includes(score)) {
      quizzTest.scores.push(score);
      await quizzTest.save();
    }

    return this.findOne(id);
  }

  async removeScore(id: string, score: string): Promise<QuizzTest> {
    const quizzTest = await this.quizzTestModel.findById(id).exec();

    if (!quizzTest) {
      throw new NotFoundException(`QuizzTest con ID ${id} no encontrado`);
    }

    quizzTest.scores = quizzTest.scores.filter((s) => s !== score);
    await quizzTest.save();

    return this.findOne(id);
  }
}
